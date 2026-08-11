import { memo, useLayoutEffect, useRef, useSignal } from '@teact';
import { addExtraClass, setExtraStyles } from '@teact/teact-dom';
import { withGlobal } from '../../global';

import type { ApiChat, ApiUserFullInfo } from '../../api/types';
import type { MessageListType, ThreadId } from '../../types';
import type { Signal } from '../../util/signals';
import { MAIN_THREAD_ID } from '../../api/types';

import {
  requestForcedReflow, requestMutation, requestNextMutation,
} from '../../lib/fasterdom/fasterdom';
import {
  selectChat,
  selectCurrentMiddleSearch,
  selectTabState,
  selectUserFullInfo,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { buildTopStackCacheKey, updateTopReserveWithScrollCompensation } from './helpers/messageListReserves';

import useShowTransition from '../../hooks/useShowTransition';
import { useSignalEffect } from '../../hooks/useSignalEffect';
import {
  applyAnimationState, commitInMutatePhase, type PaneState, toggleIslandHiddenInstantly, transitionIslandVisual,
} from './hooks/useHeaderPane';

import GroupCallTopPane from '../calls/group/GroupCallTopPane';
import BotAdPane from './panes/BotAdPane';
import BotVerificationPane from './panes/BotVerificationPane';
import ChatReportPane from './panes/ChatReportPane';
import HeaderPinnedMessage from './panes/HeaderPinnedMessage';
import PaidMessageChargePane from './panes/PaidMessageChargePane';

import styles from './MiddleHeaderPanesIsland.module.scss';

type OwnProps = {
  className?: string;
  chatId: string;
  threadId: ThreadId;
  messageListType: MessageListType;
  getCurrentPinnedIndex: Signal<number>;
  getLoadingPinnedId: Signal<number | undefined>;
  isChatClosing?: boolean;
  onFocusPinnedMessage: (messageId: number) => void;
};

type StateProps = {
  chat?: ApiChat;
  userFullInfo?: ApiUserFullInfo;
  isHidden?: boolean;
};

const FALLBACK_PANE_STATE = { height: 0 };

function getFallbackPaneState() {
  return FALLBACK_PANE_STATE;
}

function setMaskHeight(middleColumn: HTMLElement, height: number, withGlide?: boolean) {
  setExtraStyles(middleColumn, {
    '--middle-header-panes-mask-height': `${height}px`,
    '--middle-header-panes-transition': withGlide ? 'var(--mask-glide-transition)' : '0s',
  });
}

const UNHIDE_FALLBACK_MS = 1000;

const panesHeightCache = new Map<string, number>();

type IslandTransition = {
  key: string;
  generation: number;
  expectedHeight: number;
  isMorph: boolean;
  isSettled: boolean;
  hasCommitted: boolean;
};

function filterOwnPaneStates(states: PaneState[], cacheKey: string): PaneState[] {
  return states.map((state) => (
    !state.key || cacheKey === state.key || cacheKey.startsWith(`${state.key}_`)
      ? state : FALLBACK_PANE_STATE
  ));
}

const MiddleHeaderPanesIsland = ({
  className,
  chatId,
  threadId,
  messageListType,
  chat,
  userFullInfo,
  getCurrentPinnedIndex,
  getLoadingPinnedId,
  isHidden,
  isChatClosing,
  onFocusPinnedMessage,
}: OwnProps & StateProps) => {
  const { settings } = userFullInfo || {};

  const [getPinnedState, setPinnedState] = useSignal<PaneState>(FALLBACK_PANE_STATE);
  const [getGroupCallState, setGroupCallState] = useSignal<PaneState>(FALLBACK_PANE_STATE);
  const [getChatReportState, setChatReportState] = useSignal<PaneState>(FALLBACK_PANE_STATE);
  const [getBotAdState, setBotAdState] = useSignal<PaneState>(FALLBACK_PANE_STATE);
  const [getBotVerificationState, setBotVerificationState] = useSignal<PaneState>(FALLBACK_PANE_STATE);
  const [getPaidMessageChargeState, setPaidMessageChargeState] = useSignal<PaneState>(FALLBACK_PANE_STATE);

  const isGroupCallShown = threadId === MAIN_THREAD_ID && !chat?.isForum;

  const paneStateGetters = [
    isGroupCallShown ? getGroupCallState : getFallbackPaneState,
    getChatReportState, getBotVerificationState,
    getPinnedState, getBotAdState, getPaidMessageChargeState,
  ];
  const expectedReportCount = paneStateGetters.filter((getter) => getter !== getFallbackPaneState).length;
  const expectedReportCountRef = useRef(expectedReportCount);
  expectedReportCountRef.current = expectedReportCount;

  const paneStateGettersRef = useRef(paneStateGetters);
  paneStateGettersRef.current = paneStateGetters;

  const appliedReserveRef = useRef(0);
  const prevOpenCountRef = useRef(0);
  const isChatClosingRef = useRef(false);
  const prevPreloadRef = useRef<{ key: string; isHidden: boolean }>();
  const suppressRowAnimationsUntilRef = useRef(0);
  const unhideFallbackTimerRef = useRef<number>();
  const settleRef = useRef<(isFinalize?: boolean) => void>();

  const cacheKey = buildTopStackCacheKey(chatId, threadId, messageListType);
  const transitionRef = useRef<IslandTransition>();
  if (transitionRef.current?.key !== cacheKey) {
    transitionRef.current = {
      key: cacheKey,
      generation: (transitionRef.current?.generation ?? 0) + 1,
      expectedHeight: 0,
      isMorph: false,
      isSettled: false,
      hasCommitted: false,
    };
  }
  const isHiddenRef = useRef(isHidden);
  isHiddenRef.current = isHidden;

  const {
    shouldRender,
    ref,
  } = useShowTransition({
    isOpen: !isHidden,
    withShouldRender: true,
    noMountTransition: true,
  });

  useLayoutEffect(() => {
    const wasClosing = isChatClosingRef.current;
    isChatClosingRef.current = Boolean(isChatClosing);
    const container = ref.current;
    if (!container || (!isChatClosing && !wasClosing)) return;
    transitionRef.current!.generation += 1;
    const shouldHide = isChatClosing || appliedReserveRef.current === 0;
    toggleIslandHiddenInstantly(container, styles.rootHidden, Boolean(shouldHide));
  }, [isChatClosing, ref]);

  useLayoutEffect(() => {
    const middleColumn = document.getElementById('MiddleColumn');
    if (!middleColumn) return;
    const transition = transitionRef.current!;
    const prevApplied = appliedReserveRef.current;
    const preloadedPanesHeight = panesHeightCache.get(cacheKey) ?? 0;
    const panesHeight = isHidden ? 0 : preloadedPanesHeight;
    appliedReserveRef.current = panesHeight;
    prevOpenCountRef.current = panesHeight > 0 ? 1 : 0;
    transition.generation += 1;
    const generation = transition.generation;
    const isCanceled = () => transitionRef.current!.generation !== generation;

    middleColumn.querySelectorAll<HTMLElement>('.MessageList').forEach((list) => {
      const listKey = list.dataset.listKey;
      if (!listKey || listKey === cacheKey) {
        list.style.removeProperty('--message-list-mask-panes-height');
      } else {
        list.style.setProperty('--message-list-mask-panes-height', `${prevApplied}px`);
      }
    });

    const isFreshMount = prevPreloadRef.current === undefined;
    const isKeyChange = prevPreloadRef.current?.key !== cacheKey;
    prevPreloadRef.current = { key: cacheKey, isHidden: Boolean(isHidden) };

    transition.expectedHeight = panesHeight;
    const shouldGlideHeight = isKeyChange && !isHidden && prevApplied > 0 && panesHeight > 0;
    transition.isMorph = shouldGlideHeight;
    setExtraStyles(middleColumn, { '--middle-header-panes-height': `${panesHeight}px` });
    if (!shouldGlideHeight) {
      setMaskHeight(middleColumn, panesHeight);
    } else {
      setMaskHeight(middleColumn, prevApplied);
      requestNextMutation(() => {
        if (isCanceled()) return;
        setMaskHeight(middleColumn, panesHeight, true);
      });
    }
    const container = ref.current;
    if (container) {
      if (isFreshMount && panesHeight > 0) addExtraClass(container, styles.rootHidden);
      const liveStates = filterOwnPaneStates(
        paneStateGettersRef.current.map((getState) => getState()), cacheKey,
      );
      const liveTotal = liveStates.reduce((acc, state) => acc + state.height, 0);
      const shouldDeferUnhide = panesHeight > 0 && liveTotal < panesHeight;
      transitionIslandVisual({
        container,
        toHeight: panesHeight,
        shouldGlide: shouldGlideHeight,
        hiddenClassName: styles.rootHidden,
        suppressRowAnimationsUntilRef,
        noAutoUnhide: shouldDeferUnhide,
        noFade: isKeyChange,
        isCanceled,
      });
      if (shouldDeferUnhide) {
        requestForcedReflow(() => {
          return () => {
            if (isCanceled()) return;
            if (!container.classList.contains(styles.rootHidden)) return;
            const stateArray = filterOwnPaneStates(
              paneStateGettersRef.current.map((getState) => getState()), cacheKey,
            );
            const total = stateArray.reduce((acc, state) => acc + state.height, 0);
            const reportCount = stateArray.filter((state) => state.key !== undefined).length;
            if (total <= 0) return;
            if (total < panesHeight && reportCount < expectedReportCountRef.current) return;
            applyAnimationState({ list: stateArray, noTransition: true, gapPx: 0 });
            setExtraStyles(container, { '--island-height-transition': '0s', height: `${total}px` });
            setMaskHeight(middleColumn, total);
            toggleIslandHiddenInstantly(container, styles.rootHidden, false);
          };
        });
      }
      window.clearTimeout(unhideFallbackTimerRef.current);
      unhideFallbackTimerRef.current = window.setTimeout(() => {
        if (isCanceled() || isHiddenRef.current) return;
        if (transitionRef.current !== transition || transition.isSettled) return;
        transition.expectedHeight = 0;
        settleRef.current?.(true);
        if (!container.classList.contains(styles.rootHidden)) return;
        requestMutation(() => {
          if (isCanceled()) return;
          toggleIslandHiddenInstantly(container, styles.rootHidden, false);
        });
      }, UNHIDE_FALLBACK_MS);
    }
    if (!isHidden) settleRef.current?.();
  }, [isHidden, cacheKey, ref]);

  useLayoutEffect(() => {
    return () => {
      window.clearTimeout(unhideFallbackTimerRef.current);
      transitionRef.current!.generation += 1;
      settleRef.current = undefined;
    };
  }, []);

  useSignalEffect(() => {
    function settle(isForced?: boolean) {
      if (isChatClosingRef.current) return;
      if (isHiddenRef.current) return;
      const transition = transitionRef.current!;
      const currentKey = transition.key;

      const stateArray = filterOwnPaneStates(
        paneStateGettersRef.current.map((getState) => getState()), transition.key,
      );

      const isSettling = !transition.isSettled;

      const openCount = stateArray.filter((s) => s.height > 0).length;
      const totalHeight = stateArray.reduce((acc, state) => acc + state.height, 0);
      const ownReportCount = stateArray.filter((state) => state.key !== undefined).length;
      const hasPendingPanes = stateArray.some((state) => state.isPending);

      const isRealizingPreload = transition.expectedHeight > 0;
      if (isRealizingPreload && totalHeight >= transition.expectedHeight) {
        transition.expectedHeight = 0;
      }

      const middleColumn = document.getElementById('MiddleColumn');
      if (!middleColumn) return;

      const isFirstPaneAppear = prevOpenCountRef.current === 0 && openCount > 0;

      const container = ref.current;
      const isIslandHidden = Boolean(container?.classList.contains(styles.rootHidden));
      const didRealizePreload = isRealizingPreload && transition.expectedHeight === 0;
      const isAwaitingPreloadedRows = transition.expectedHeight > 0 && hasPendingPanes;
      const shouldConcludeSettle = isSettling
        && (Boolean(isForced) || (ownReportCount >= expectedReportCountRef.current && !isAwaitingPreloadedRows));
      const shouldSkipPlacement = totalHeight === 0
        || (isSettling && !shouldConcludeSettle && isIslandHidden && !didRealizePreload);
      if (!shouldSkipPlacement) {
        const isMorph = transition.isMorph;
        commitInMutatePhase(() => {
          if (transitionRef.current !== transition) return;
          const noTransition = !isMorph && (isSettling || isFirstPaneAppear || isRealizingPreload
            || performance.now() < suppressRowAnimationsUntilRef.current);
          applyAnimationState({
            list: stateArray, noTransition, snapEntrancesOnly: isMorph, gapPx: 0,
          });
        });
      }

      if (didRealizePreload && container && isIslandHidden) {
        transition.hasCommitted = true;
        commitInMutatePhase(() => {
          if (transitionRef.current !== transition) return;
          applyAnimationState({ list: stateArray, noTransition: true, gapPx: 0 });
          setExtraStyles(container, { '--island-height-transition': '0s', height: `${totalHeight}px` });
          setMaskHeight(middleColumn, totalHeight);
          toggleIslandHiddenInstantly(container, styles.rootHidden, false);
        });
      }

      if (isRealizingPreload && transition.expectedHeight > 0 && !shouldConcludeSettle) return;

      if (isSettling && !shouldConcludeSettle) return;

      if (shouldConcludeSettle) {
        transition.isSettled = true;
        transition.isMorph = false;
        transition.expectedHeight = 0;
      }

      const reserveDelta = totalHeight - appliedReserveRef.current;
      if (!reserveDelta && !shouldConcludeSettle) return;

      const isInstantReveal = isRealizingPreload || !transition.hasCommitted;
      transition.hasCommitted = true;
      prevOpenCountRef.current = openCount;
      appliedReserveRef.current = totalHeight;
      panesHeightCache.set(currentKey, totalHeight);

      transition.generation += 1;
      const generation = transition.generation;
      const isCanceled = () => transitionRef.current!.generation !== generation;
      updateTopReserveWithScrollCompensation(middleColumn, reserveDelta, () => {
        if (isCanceled()) return;
        setExtraStyles(middleColumn, {
          '--middle-header-panes-height': `${totalHeight}px`,
        });

        if (container) {
          transitionIslandVisual({
            container,
            toHeight: totalHeight,
            shouldGlide: !isInstantReveal,
            hiddenClassName: styles.rootHidden,
            suppressRowAnimationsUntilRef,
            noFade: isInstantReveal,
            isCanceled,
          });
        }

        if (isInstantReveal) {
          setMaskHeight(middleColumn, totalHeight);
        } else {
          requestNextMutation(() => {
            if (isCanceled()) return;
            setMaskHeight(middleColumn, totalHeight, true);
          });
        }
      }, container && [container]);
    }

    settleRef.current = settle;
    settle();
  }, [cacheKey, getGroupCallState, getPinnedState,
    getChatReportState, getBotAdState, getBotVerificationState, getPaidMessageChargeState]);

  if (!shouldRender) return undefined;

  return (
    <div
      ref={ref}
      className={
        buildClassName(
          'MiddleHeaderPanesIsland',
          styles.root,
          className,
        )
      }
    >
      {isGroupCallShown && (
        <GroupCallTopPane
          chatId={chatId}
          onPaneStateChange={setGroupCallState}
        />
      )}
      <ChatReportPane
        chatId={chatId}
        canAddContact={settings?.canAddContact}
        canBlockContact={settings?.canBlockContact}
        canReportSpam={settings?.canReportSpam}
        isAutoArchived={settings?.isAutoArchived}
        onPaneStateChange={setChatReportState}
      />
      <BotVerificationPane
        peerId={chatId}
        onPaneStateChange={setBotVerificationState}
      />
      <HeaderPinnedMessage
        chatId={chatId}
        threadId={threadId}
        messageListType={messageListType}
        onFocusPinnedMessage={onFocusPinnedMessage}
        getLoadingPinnedId={getLoadingPinnedId}
        getCurrentPinnedIndex={getCurrentPinnedIndex}
        onPaneStateChange={setPinnedState}
      />
      <BotAdPane
        chatId={chatId}
        messageListType={messageListType}
        onPaneStateChange={setBotAdState}
      />
      <PaidMessageChargePane
        peerId={chatId}
        onPaneStateChange={setPaidMessageChargeState}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, {
    chatId,
  }): Complete<StateProps> => {
    const chat = selectChat(global, chatId);
    const userFullInfo = selectUserFullInfo(global, chatId);

    return {
      chat,
      userFullInfo,
      isHidden: Boolean(selectCurrentMiddleSearch(global) || selectTabState(global).isRichInputExpanded),
    };
  },
)(MiddleHeaderPanesIsland));
