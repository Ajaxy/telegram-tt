import type { RefObject } from 'react';
import { getActions } from '../../../global';
import { useMemo, useRef } from '../../../lib/teact/teact';

import { LoadMoreDirection } from '../../../types';
import type { MessageListType } from '../../../global/types';

import { LOCAL_MESSAGE_MIN_ID, MESSAGE_LIST_SLICE } from '../../../config';
import { IS_SCROLL_PATCH_NEEDED, MESSAGE_LIST_SENSITIVE_AREA } from '../../../util/environment';
import { debounce } from '../../../util/schedulers';
import { useIntersectionObserver, useOnIntersect } from '../../../hooks/useIntersectionObserver';
import useSyncEffect from '../../../hooks/useSyncEffect';

const FAB_THRESHOLD = 50;
const NOTCH_THRESHOLD = 1; // Notch has zero height so we at least need a 1px margin to intersect
const TOOLS_FREEZE_TIMEOUT = 250; // Approximate message sending animation duration

export default function useScrollHooks(
  type: MessageListType,
  containerRef: RefObject<HTMLDivElement>,
  messageIds: number[],
  isViewportNewest: boolean,
  isUnread: boolean,
  onFabToggle: AnyToVoidFunction,
  onNotchToggle: AnyToVoidFunction,
  isReady: boolean,
  isScrollingRef: { current: boolean | undefined },
  isScrollPatchNeededRef: { current: boolean | undefined },
) {
  const { loadViewportMessages } = getActions();

  const [loadMoreBackwards, loadMoreForwards] = useMemo(
    () => (type === 'thread' ? [
      debounce(() => loadViewportMessages({ direction: LoadMoreDirection.Backwards }), 1000, true, false),
      debounce(() => loadViewportMessages({ direction: LoadMoreDirection.Forwards }), 1000, true, false),
    ] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadViewportMessages, messageIds],
  );

  // eslint-disable-next-line no-null/no-null
  const backwardsTriggerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const forwardsTriggerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const fabTriggerRef = useRef<HTMLDivElement>(null);

  function toggleScrollTools() {
    if (!isReady) return;

    if (!messageIds || !messageIds.length) {
      onFabToggle(false);
      onNotchToggle(false);
      return;
    }

    if (!isViewportNewest) {
      onFabToggle(true);
      onNotchToggle(true);
      return;
    }

    if (!containerRef.current) {
      return;
    }

    const { offsetHeight, scrollHeight, scrollTop } = containerRef.current;
    const scrollBottom = Math.round(scrollHeight - scrollTop - offsetHeight);
    const isNearBottom = scrollBottom <= FAB_THRESHOLD;
    const isAtBottom = scrollBottom <= NOTCH_THRESHOLD;

    if (scrollHeight === 0) return;

    onFabToggle(isUnread ? !isAtBottom : !isNearBottom);
    onNotchToggle(!isAtBottom);
  }

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
    const isFirstMessageLocal = messageIds[0] > LOCAL_MESSAGE_MIN_ID;
    if (isFirstMessageLocal) {
      return;
    }

    const triggerEntry = entries.find(({ isIntersecting }) => isIntersecting);
    if (!triggerEntry) {
      return;
    }

    const { target } = triggerEntry;

    if (target.className === 'backwards-trigger') {
      if (
        IS_SCROLL_PATCH_NEEDED && isScrollingRef.current && messageIds.length <= MESSAGE_LIST_SLICE
      ) {
        isScrollPatchNeededRef.current = true;
      }

      loadMoreBackwards();
    } else if (target.className === 'forwards-trigger') {
      loadMoreForwards();
    }
  });

  useOnIntersect(backwardsTriggerRef, observeIntersection);
  useOnIntersect(forwardsTriggerRef, observeIntersection);

  const {
    observe: observeIntersectionForFab,
    freeze: freezeForFab,
    unfreeze: unfreezeForFab,
  } = useIntersectionObserver({
    rootRef: containerRef,
    margin: FAB_THRESHOLD * 2,
  }, toggleScrollTools);

  useOnIntersect(fabTriggerRef, observeIntersectionForFab);

  const {
    observe: observeIntersectionForNotch,
    freeze: freezeForNotch,
    unfreeze: unfreezeForNotch,
  } = useIntersectionObserver({
    rootRef: containerRef,
    margin: NOTCH_THRESHOLD,
  }, toggleScrollTools);

  useOnIntersect(fabTriggerRef, observeIntersectionForNotch);

  const toggleScrollToolsRef = useRef<typeof toggleScrollTools>();
  toggleScrollToolsRef.current = toggleScrollTools;
  useSyncEffect(() => {
    if (isReady) {
      toggleScrollToolsRef.current!();
    }
  }, [isReady]);

  // Workaround for FAB and notch flickering with tall incoming message
  useSyncEffect(() => {
    freezeForFab();
    freezeForNotch();

    setTimeout(() => {
      unfreezeForNotch();
      unfreezeForFab();
    }, TOOLS_FREEZE_TIMEOUT);
  }, [freezeForFab, freezeForNotch, messageIds, unfreezeForFab, unfreezeForNotch]);

  return { backwardsTriggerRef, forwardsTriggerRef, fabTriggerRef };
}
