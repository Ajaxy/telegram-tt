import type { RefObject } from 'react';
import { useEffect, useMemo, useRef } from '../../../lib/teact/teact';
import { requestMeasure } from '../../../lib/fasterdom/fasterdom';
import { getActions } from '../../../global';

import { LoadMoreDirection } from '../../../types';
import type { MessageListType } from '../../../global/types';
import type { Signal } from '../../../util/signals';

import { MESSAGE_LIST_SENSITIVE_AREA } from '../../../util/windowEnvironment';
import { debounce } from '../../../util/schedulers';
import { isLocalMessageId } from '../../../global/helpers';

import useLastCallback from '../../../hooks/useLastCallback';
import { useIntersectionObserver, useOnIntersect } from '../../../hooks/useIntersectionObserver';
import useSyncEffect from '../../../hooks/useSyncEffect';
import { useSignalEffect } from '../../../hooks/useSignalEffect';
import { useDebouncedSignal } from '../../../hooks/useAsyncResolvers';

const FAB_THRESHOLD = 50;
const NOTCH_THRESHOLD = 1; // Notch has zero height so we at least need a 1px margin to intersect
const CONTAINER_HEIGHT_DEBOUNCE = 200;
const TOOLS_FREEZE_TIMEOUT = 350; // Approximate message sending animation duration

export default function useScrollHooks(
  type: MessageListType,
  containerRef: RefObject<HTMLDivElement>,
  messageIds: number[],
  getContainerHeight: Signal<number | undefined>,
  isViewportNewest: boolean,
  isUnread: boolean,
  onFabToggle: AnyToVoidFunction,
  onNotchToggle: AnyToVoidFunction,
  isReady: boolean,
) {
  const { loadViewportMessages } = getActions();

  const [loadMoreBackwards, loadMoreForwards] = useMemo(
    () => (type === 'thread' ? [
      debounce(() => loadViewportMessages({ direction: LoadMoreDirection.Backwards }), 1000, true, false),
      debounce(() => loadViewportMessages({ direction: LoadMoreDirection.Forwards }), 1000, true, false),
    ] : []),
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
    [loadViewportMessages, messageIds],
  );

  // eslint-disable-next-line no-null/no-null
  const backwardsTriggerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const forwardsTriggerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const fabTriggerRef = useRef<HTMLDivElement>(null);

  const toggleScrollTools = useLastCallback(() => {
    if (!isReady) return;

    if (!messageIds?.length) {
      onFabToggle(false);
      onNotchToggle(false);
      return;
    }

    if (!isViewportNewest) {
      onFabToggle(true);
      onNotchToggle(true);
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const { offsetHeight, scrollHeight, scrollTop } = container;
    const scrollBottom = Math.round(scrollHeight - scrollTop - offsetHeight);
    const isNearBottom = scrollBottom <= FAB_THRESHOLD;
    const isAtBottom = scrollBottom <= NOTCH_THRESHOLD;

    if (scrollHeight === 0) return;

    onFabToggle(isUnread ? !isAtBottom : !isNearBottom);
    onNotchToggle(!isAtBottom);
  });

  const {
    observe: observeIntersection,
  } = useIntersectionObserver({
    rootRef: containerRef,
    margin: MESSAGE_LIST_SENSITIVE_AREA,
  }, (entries) => {
    if (!loadMoreForwards || !loadMoreBackwards) {
      return;
    }

    // Loading history while sending a message can return the same message and cause ambiguity
    const isFirstMessageLocal = isLocalMessageId(messageIds[0]);
    if (isFirstMessageLocal) {
      return;
    }

    const triggerEntry = entries.find(({ isIntersecting }) => isIntersecting);
    if (!triggerEntry) {
      return;
    }

    const { target } = triggerEntry;

    if (target.className === 'backwards-trigger') {
      loadMoreBackwards();
    } else if (target.className === 'forwards-trigger') {
      loadMoreForwards();
    }
  });

  const withHistoryTriggers = messageIds && messageIds.length > 1;

  useOnIntersect(backwardsTriggerRef, withHistoryTriggers ? observeIntersection : undefined);
  useOnIntersect(forwardsTriggerRef, withHistoryTriggers ? observeIntersection : undefined);

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
  }, [isReady, toggleScrollTools]);

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
