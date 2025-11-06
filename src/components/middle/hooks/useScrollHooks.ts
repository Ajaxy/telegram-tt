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
import { useIntersectionObserver, useOnIntersect } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import { useSignalEffect } from '../../../hooks/useSignalEffect';
import useSyncEffect from '../../../hooks/useSyncEffect';

const FAB_THRESHOLD = 50;
const NOTCH_THRESHOLD = 1; // Notch has zero height so we at least need a 1px margin to intersect
const CONTAINER_HEIGHT_DEBOUNCE = 200;
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

  const toggleScrollTools = useLastCallback(() => {
    if (!isReady) return;

    if (!messageIds?.length) {
      onScrollDownToggle?.(false);
      onNotchToggle?.(false);

      return;
    }

    if (!isViewportNewest) {
      onScrollDownToggle?.(true);
      onNotchToggle?.(true);

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

    onScrollDownToggle?.(isUnread ? !isAtBottom : !isNearBottom);
    onNotchToggle?.(!isAtBottom);
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
  }, toggleScrollTools);

  useOnIntersect(fabTriggerRef, observeIntersectionForFab);

  const {
    observe: observeIntersectionForNotch,
    freeze: freezeForNotch,
    unfreeze: unfreezeForNotch,
  } = useIntersectionObserver({
    rootRef: containerRef,
    margin: NOTCH_THRESHOLD,
    throttleScheduler: requestMeasure,
  }, toggleScrollTools);

  useOnIntersect(fabTriggerRef, observeIntersectionForNotch);

  useEffect(() => {
    if (isReady) {
      toggleScrollTools();
    }
  }, [isReady]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scrollend', toggleScrollTools);

    return () => {
      container.removeEventListener('scrollend', toggleScrollTools);
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
