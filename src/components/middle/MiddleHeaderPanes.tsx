import { memo, useLayoutEffect, useRef, useSignal } from '@teact';
import { setExtraStyles } from '@teact/teact-dom';
import { withGlobal } from '../../global';

import type { ApiChat, ApiUserFullInfo } from '../../api/types';
import type { MessageListType, ThreadId } from '../../types';
import type { Signal } from '../../util/signals';
import { MAIN_THREAD_ID } from '../../api/types';

import { requestForcedReflow, requestMeasure, requestMutation } from '../../lib/fasterdom/fasterdom';
import {
  selectCanAnimateRightColumn,
  selectChat,
  selectCurrentMiddleSearch,
  selectUserFullInfo,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { REM } from '../common/helpers/mediaDimensions';
import { BOTTOM_PIN_THRESHOLD, SCROLL_BOTTOM_SENTINEL, TOP_PIN_THRESHOLD } from './helpers/messageListReserves';

import useEffectOnce from '../../hooks/useEffectOnce';
import useShowTransition from '../../hooks/useShowTransition';
import { useSignalEffect } from '../../hooks/useSignalEffect';
import { applyAnimationState, PANE_GAP_REM, type PaneState } from './hooks/useHeaderPane';

import GroupCallTopPane from '../calls/group/GroupCallTopPane';
import AudioPlayer from './panes/AudioPlayer';
import BotAdPane from './panes/BotAdPane';
import BotVerificationPane from './panes/BotVerificationPane';
import ChatReportPane from './panes/ChatReportPane';
import HeaderPinnedMessage from './panes/HeaderPinnedMessage';
import PaidMessageChargePane from './panes/PaidMessageChargePane';

import styles from './MiddleHeaderPanes.module.scss';

type OwnProps = {
  className?: string;
  chatId: string;
  threadId: ThreadId;
  messageListType: MessageListType;
  getCurrentPinnedIndex: Signal<number>;
  getLoadingPinnedId: Signal<number | undefined>;
  onFocusPinnedMessage: (messageId: number) => void;
};

type StateProps = {
  chat?: ApiChat;
  userFullInfo?: ApiUserFullInfo;
  withRightColumnAnimation?: boolean;
  isMiddleSearchOpen?: boolean;
};

const FALLBACK_PANE_STATE = { height: 0 };

const panesHeightCache = new Map<string, number>();

function getReserveCacheKey(chatId: string, threadId: ThreadId, messageListType: MessageListType) {
  return `${chatId}_${threadId}_${messageListType}`;
}

const MiddleHeaderPanes = ({
  className,
  chatId,
  threadId,
  messageListType,
  chat,
  userFullInfo,
  getCurrentPinnedIndex,
  getLoadingPinnedId,
  withRightColumnAnimation,
  isMiddleSearchOpen,
  onFocusPinnedMessage,
}: OwnProps & StateProps) => {
  const { settings } = userFullInfo || {};

  const [getAudioPlayerState, setAudioPlayerState] = useSignal<PaneState>(FALLBACK_PANE_STATE);
  const [getPinnedState, setPinnedState] = useSignal<PaneState>(FALLBACK_PANE_STATE);
  const [getGroupCallState, setGroupCallState] = useSignal<PaneState>(FALLBACK_PANE_STATE);
  const [getChatReportState, setChatReportState] = useSignal<PaneState>(FALLBACK_PANE_STATE);
  const [getBotAdState, setBotAdState] = useSignal<PaneState>(FALLBACK_PANE_STATE);
  const [getBotVerificationState, setBotVerificationState] = useSignal<PaneState>(FALLBACK_PANE_STATE);
  const [getPaidMessageChargeState, setPaidMessageChargeState] = useSignal<PaneState>(FALLBACK_PANE_STATE);

  const isFirstRenderRef = useRef(true);
  const prevPanesHeightRef = useRef(0);

  const cacheKey = getReserveCacheKey(chatId, threadId, messageListType);
  const isReopen = panesHeightCache.has(cacheKey);

  useLayoutEffect(() => {
    const middleColumn = document.getElementById('MiddleColumn');
    if (!middleColumn) return;
    setExtraStyles(middleColumn, {
      '--middle-header-panes-height': isMiddleSearchOpen ? '0px' : `${panesHeightCache.get(cacheKey) ?? 0}px`,
    });
  }, [isMiddleSearchOpen, cacheKey]);

  const {
    shouldRender,
    ref,
  } = useShowTransition({
    isOpen: !isMiddleSearchOpen,
    withShouldRender: true,
    noMountTransition: true,
  });

  useEffectOnce(() => {
    isFirstRenderRef.current = false;
  });

  useSignalEffect(() => {
    const audioPlayerState = getAudioPlayerState();
    const botVerificationState = getBotVerificationState();
    const pinnedState = getPinnedState();
    const groupCallState = getGroupCallState();
    const chatReportState = getChatReportState();
    const botAdState = getBotAdState();
    const paidMessageState = getPaidMessageChargeState();

    // Keep in sync with the order of the panes in the DOM
    const stateArray = [audioPlayerState, groupCallState,
      chatReportState, botVerificationState, pinnedState, botAdState, paidMessageState];

    const isFirstRender = isFirstRenderRef.current;
    const gapPx = PANE_GAP_REM * REM;
    const openCount = stateArray.filter((s) => s.height > 0).length;
    const panesHeight = stateArray.reduce((acc, state) => acc + state.height, 0);
    const totalHeight = panesHeight ? panesHeight + (openCount - 1) * gapPx : 0;

    const middleColumn = document.getElementById('MiddleColumn');
    if (!middleColumn) return;

    const prevPanesHeight = prevPanesHeightRef.current;
    const panesHeightDelta = totalHeight - prevPanesHeight;
    prevPanesHeightRef.current = totalHeight;

    const shouldWriteReserve = totalHeight > 0 || prevPanesHeight > 0 || isFirstRender;
    if (shouldWriteReserve) {
      panesHeightCache.set(cacheKey, totalHeight);
    }

    requestMutation(() => {
      applyAnimationState({ list: stateArray, noTransition: isFirstRender && isReopen });
    });

    const scrollers = panesHeightDelta
      ? Array.from(middleColumn.querySelectorAll<HTMLElement>('.MessageList'))
      : [];

    requestMeasure(() => {
      const plans = scrollers
        .filter((scroller) => scroller.offsetParent)
        .map((scroller) => ({
          scroller,
          wasAtBottom: scroller.scrollHeight - scroller.scrollTop - scroller.offsetHeight <= BOTTOM_PIN_THRESHOLD,
          wasAtTop: scroller.scrollTop <= TOP_PIN_THRESHOLD,
          prevScrollTop: scroller.scrollTop,
          bottomDistance: scroller.scrollHeight - scroller.scrollTop,
        }));

      if (shouldWriteReserve) {
        requestMutation(() => {
          setExtraStyles(middleColumn, {
            '--middle-header-panes-height': `${totalHeight}px`,
          });
        });
      }

      if (!plans.length) return;

      requestForcedReflow(() => {
        const targets = plans.map(({
          scroller, wasAtBottom, wasAtTop, prevScrollTop, bottomDistance,
        }) => {
          let scrollTop;
          if (wasAtBottom) {
            scrollTop = SCROLL_BOTTOM_SENTINEL;
          } else if (wasAtTop) {
            scrollTop = prevScrollTop;
          } else {
            scrollTop = scroller.scrollHeight - bottomDistance;
          }
          return { scroller, scrollTop };
        });

        return () => {
          targets.forEach(({ scroller, scrollTop }) => {
            scroller.scrollTop = scrollTop;
          });
        };
      });
    });
  }, [getAudioPlayerState, getGroupCallState, getPinnedState,
    getChatReportState, getBotAdState, getBotVerificationState, getPaidMessageChargeState]);

  if (!shouldRender) return undefined;

  return (
    <div
      ref={ref}
      className={
        buildClassName(
          'MiddleHeaderPanes',
          styles.root,
          withRightColumnAnimation && styles.root_withRightColumnAnimation,
          className,
        )
      }
    >
      <AudioPlayer
        onPaneStateChange={setAudioPlayerState}
      />
      {threadId === MAIN_THREAD_ID && !chat?.isForum && (
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
      <PaidMessageChargePane
        peerId={chatId}
        onPaneStateChange={setPaidMessageChargeState}
      />
      <HeaderPinnedMessage
        chatId={chatId}
        threadId={threadId}
        messageListType={messageListType}
        onFocusPinnedMessage={onFocusPinnedMessage}
        getLoadingPinnedId={getLoadingPinnedId}
        getCurrentPinnedIndex={getCurrentPinnedIndex}
        onPaneStateChange={setPinnedState}
        isReopen={isReopen}
      />
      <BotAdPane
        chatId={chatId}
        messageListType={messageListType}
        onPaneStateChange={setBotAdState}
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
      withRightColumnAnimation: selectCanAnimateRightColumn(global),
      isMiddleSearchOpen: Boolean(selectCurrentMiddleSearch(global)),
    };
  },
)(MiddleHeaderPanes));
