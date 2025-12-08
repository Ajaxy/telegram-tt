import type { ElementRef } from '../../../lib/teact/teact';
import { useEffect, useMemo, useRef } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { MessageListType } from '../../../types';
import type { Signal } from '../../../util/signals';
import { LoadMoreDirection } from '../../../types';

import { requestMeasure } from '../../../lib/fasterdom/fasterdom';
import { MESSAGE_LIST_SENSITIVE_AREA } from '../../../util/browser/windowEnvironment';
import { debounce } from '../../../util/schedulers';

import { useDebouncedSignal } from '../../../hooks/useAsyncResolvers';
import useDebouncedCallback from '../../../hooks/useDebouncedCallback';
import { useIntersectionObserver, useOnIntersect } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import { useSignalEffect } from '../../../hooks/useSignalEffect';
import useSyncEffect from '../../../hooks/useSyncEffect';

const FAB_THRESHOLD = 50;
const NOTCH_THRESHOLD = 1; // Notch has zero height so we at least need a 1px margin to intersect
const CONTAINER_HEIGHT_DEBOUNCE = 200;
const SCROLL_TOOLS_DEBOUNCE = 100;
const TOOLS_FREEZE_TIMEOUT = 350; // Approximate message sending animation duration

export default function useScrollHooks({
  type,
  containerRef,
  messageIds,
  getContainerHeight,
  isViewportNewest,
  isUnread,
  isReady,
  onScrollDownToggle,
  onNotchToggle,
}: {
  type: MessageListType;
  containerRef: ElementRef<HTMLDivElement>;
  messageIds: number[];
  getContainerHeight: Signal<number | undefined>;
  isViewportNewest: boolean;
  isUnread: boolean;
  isReady: boolean;
  onScrollDownToggle: BooleanToVoidFunction | undefined;
  onNotchToggle: AnyToVoidFunction | undefined;
}) {
  const { loadViewportMessages } = getActions();

  const [loadMoreBackwards, loadMoreForwards] = useMemo(
    () => (type === 'thread' ? [
      debounce(() => loadViewportMessages({ direction: LoadMoreDirection.Backwards }), 1000, true, false),
      debounce(() => loadViewportMessages({ direction: LoadMoreDirection.Forwards }), 1000, true, false),
    ] : []),
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
    [loadViewportMessages, messageIds],
  );

  const backwardsTriggerRef = useRef<HTMLDivElement>();
  const forwardsTriggerRef = useRef<HTMLDivElement>();
  const fabTriggerRef = useRef<HTMLDivElement>();

  const toggleScrollTools = useLastCallback((scrollDown: boolean, notch: boolean) => {
    onScrollDownToggle?.(scrollDown);
    onNotchToggle?.(notch);
  });

  const toggleScrollToolsDebounced = useDebouncedCallback(
    toggleScrollTools, [toggleScrollTools], SCROLL_TOOLS_DEBOUNCE, true, false,
  );

  const updateScrollTools = useLastCallback(() => {
    if (!isReady) return;

    if (!messageIds?.length) {
      toggleScrollTools(false, false);

      return;
    }

    if (!isViewportNewest) {
      toggleScrollToolsDebounced(true, true);

      return;
    }

    const container = containerRef.current;
    const fabTrigger = fabTriggerRef.current;
    if (!container || !fabTrigger) return;

    const { offsetHeight, scrollHeight, scrollTop } = container;
    const fabOffsetTop = fabTrigger.offsetTop;
    const scrollBottom = Math.round(fabOffsetTop - scrollTop - offsetHeight);
    const isNearBottom = scrollBottom <= FAB_THRESHOLD;
    const isAtBottom = scrollBottom <= NOTCH_THRESHOLD;

    if (scrollHeight === 0) return;

    toggleScrollToolsDebounced(isUnread ? !isAtBottom : !isNearBottom, !isAtBottom);
  });

  const {
    observe: observeIntersectionForHistory,
  } = useIntersectionObserver({
    rootRef: containerRef,
    margin: MESSAGE_LIST_SENSITIVE_AREA,
  }, (entries) => {
    if (!loadMoreForwards || !loadMoreBackwards) {
      return;
    }

    entries.forEach(({ isIntersecting, target }) => {
      if (!isIntersecting) return;

      if (target.className === 'backwards-trigger') {
        loadMoreBackwards();
      }

      if (target.className === 'forwards-trigger') {
        loadMoreForwards();
      }
    });
  });

  const withHistoryTriggers = messageIds && messageIds.length > 1;

  useOnIntersect(backwardsTriggerRef, withHistoryTriggers ? observeIntersectionForHistory : undefined);
  useOnIntersect(forwardsTriggerRef, withHistoryTriggers ? observeIntersectionForHistory : undefined);

  const {
    observe: observeIntersectionForFab,
    freeze: freezeForFab,
    unfreeze: unfreezeForFab,
  } = useIntersectionObserver({
    rootRef: containerRef,
    margin: FAB_THRESHOLD * 2,
    throttleScheduler: requestMeasure,
  }, updateScrollTools);

  useOnIntersect(fabTriggerRef, observeIntersectionForFab);

  const {
    observe: observeIntersectionForNotch,
    freeze: freezeForNotch,
    unfreeze: unfreezeForNotch,
  } = useIntersectionObserver({
    rootRef: containerRef,
    margin: NOTCH_THRESHOLD,
    throttleScheduler: requestMeasure,
  }, updateScrollTools);

  useOnIntersect(fabTriggerRef, observeIntersectionForNotch);

  useEffect(() => {
    if (isReady) {
      updateScrollTools();
    }
  }, [isReady]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scrollend', updateScrollTools);

    return () => {
      container.removeEventListener('scrollend', updateScrollTools);
    };
  }, [containerRef]);

  const freezeShortly = useLastCallback(() => {
    freezeForFab();
    freezeForNotch();

    setTimeout(() => {
      unfreezeForNotch();
      unfreezeForFab();
    }, TOOLS_FREEZE_TIMEOUT);
  });

  // Workaround for FAB and notch flickering with tall incoming message
  useSyncEffect(freezeShortly, [freezeShortly, messageIds]);

  // Workaround for notch flickering when opening Composer Embedded Message
  const getContainerHeightDebounced = useDebouncedSignal(getContainerHeight, CONTAINER_HEIGHT_DEBOUNCE);
  useSignalEffect(freezeShortly, [freezeShortly, getContainerHeightDebounced]);

  return {
    withHistoryTriggers,
    backwardsTriggerRef,
    forwardsTriggerRef,
    fabTriggerRef,
  };
}
