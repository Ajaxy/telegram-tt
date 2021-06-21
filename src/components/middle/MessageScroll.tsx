import { MutableRefObject } from 'react';
import React, { FC, useCallback, useRef } from '../../lib/teact/teact';

import { MESSAGE_LIST_SENSITIVE_AREA } from '../../config';
import resetScroll from '../../util/resetScroll';
import { useIntersectionObserver, useOnIntersect } from '../../hooks/useIntersectionObserver';
import useOnChange from '../../hooks/useOnChange';

type OwnProps = {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  className: string;
  messageIds: number[];
  isFocusing: boolean;
  loadMoreForwards?: NoneToVoidFunction;
  loadMoreBackwards?: NoneToVoidFunction;
  isViewportNewest?: boolean;
  firstUnreadId?: number;
  onFabToggle: AnyToVoidFunction;
  onNotchToggle: AnyToVoidFunction;
  children: any;
};

const FAB_THRESHOLD = 50;
const TOOLS_FREEZE_TIMEOUT = 100;

const MessageScroll: FC<OwnProps> = ({
  containerRef,
  className,
  messageIds,
  isFocusing,
  loadMoreForwards,
  loadMoreBackwards,
  isViewportNewest,
  firstUnreadId,
  onFabToggle,
  onNotchToggle,
  children,
}) => {
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

    onFabToggle(firstUnreadId ? !isAtBottom : !isNearBottom);
    onNotchToggle(!isAtBottom);
  }, [messageIds, isViewportNewest, containerRef, onFabToggle, firstUnreadId, onNotchToggle]);

  const {
    observe: observeIntersection,
    freeze: freezeForLoadMore,
    unfreeze: unfreezeForLoadMore,
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

  useOnChange(() => {
    if (isFocusing) {
      freezeForLoadMore();
    } else {
      unfreezeForLoadMore();
    }
  }, [isFocusing]);

  // Workaround for FAB and notch flickering with tall incoming message
  useOnChange(() => {
    freezeForFab();
    freezeForNotch();

    setTimeout(() => {
      unfreezeForNotch();
      unfreezeForFab();
    }, TOOLS_FREEZE_TIMEOUT);
  }, [messageIds]);

  return (
    <div className={className} teactFastList>
      <div ref={backwardsTriggerRef} key="backwards-trigger" className="backwards-trigger" />
      {children}
      <div
        ref={forwardsTriggerRef}
        key="forwards-trigger"
        className="forwards-trigger"
      />
      <div
        ref={fabTriggerRef}
        key="fab-trigger"
        className="fab-trigger"
      />
    </div>
  );
};

export default MessageScroll;
