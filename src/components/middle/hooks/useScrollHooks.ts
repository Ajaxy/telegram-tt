import { RefObject } from 'react';
import { getDispatch } from '../../../lib/teact/teactn';
import { useCallback, useMemo, useRef } from '../../../lib/teact/teact';

import { LoadMoreDirection } from '../../../types';
import { MessageListType } from '../../../global/types';

import { debounce } from '../../../util/schedulers';
import { useIntersectionObserver, useOnIntersect } from '../../../hooks/useIntersectionObserver';
import { MESSAGE_LIST_SENSITIVE_AREA } from '../../../config';
import resetScroll from '../../../util/resetScroll';
import useOnChange from '../../../hooks/useOnChange';

const FAB_THRESHOLD = 50;
const TOOLS_FREEZE_TIMEOUT = 100;

export default function useScrollHooks(
  type: MessageListType,
  containerRef: RefObject<HTMLDivElement>,
  messageIds: number[],
  isViewportNewest: boolean,
  isUnread: boolean,
  onFabToggle: AnyToVoidFunction,
  onNotchToggle: AnyToVoidFunction,
) {
  const { loadViewportMessages } = getDispatch();

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

  const toggleScrollTools = useCallback(() => {
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

    const { offsetHeight, scrollHeight, scrollTop } = containerRef.current!;
    const scrollBottom = scrollHeight - scrollTop - offsetHeight;
    const isNearBottom = scrollBottom <= FAB_THRESHOLD;
    const isAtBottom = scrollBottom <= 0;

    onFabToggle(isUnread ? !isAtBottom : !isNearBottom);
    onNotchToggle(!isAtBottom);
  }, [messageIds, isViewportNewest, containerRef, onFabToggle, isUnread, onNotchToggle]);

  const {
    observe: observeIntersection,
  } = useIntersectionObserver({
    rootRef: containerRef,
    margin: MESSAGE_LIST_SENSITIVE_AREA,
  }, (entries) => {
    if (!loadMoreForwards || !loadMoreBackwards) {
      return;
    }

    const triggerEntry = entries.find(({ isIntersecting }) => isIntersecting);
    if (!triggerEntry) {
      return;
    }

    const { target } = triggerEntry;

    if (target.className === 'backwards-trigger') {
      resetScroll(containerRef.current!);
      loadMoreBackwards();
    } else if (target.className === 'forwards-trigger') {
      resetScroll(containerRef.current!);
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
    margin: FAB_THRESHOLD,
  }, toggleScrollTools);

  useOnIntersect(fabTriggerRef, observeIntersectionForFab);

  const {
    observe: observeIntersectionForNotch,
    freeze: freezeForNotch,
    unfreeze: unfreezeForNotch,
  } = useIntersectionObserver({
    rootRef: containerRef,
  }, toggleScrollTools);

  useOnIntersect(fabTriggerRef, observeIntersectionForNotch);

  // Workaround for FAB and notch flickering with tall incoming message
  useOnChange(() => {
    freezeForFab();
    freezeForNotch();

    setTimeout(() => {
      unfreezeForNotch();
      unfreezeForFab();
    }, TOOLS_FREEZE_TIMEOUT);
  }, [messageIds]);

  return { backwardsTriggerRef, forwardsTriggerRef, fabTriggerRef };
}
