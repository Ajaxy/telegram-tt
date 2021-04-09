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
  containerHeight?: number;
  listItemElementsRef: MutableRefObject<HTMLDivElement[] | undefined>;
  anchorIdRef: MutableRefObject<string | undefined>;
  anchorTopRef: MutableRefObject<number | undefined>;
  loadMoreForwards?: NoneToVoidFunction;
  loadMoreBackwards?: NoneToVoidFunction;
  isViewportNewest?: boolean;
  firstUnreadId?: number;
  focusingId?: number;
  onFabToggle: AnyToVoidFunction;
  children: any;
};

const FAB_THRESHOLD = 100;

const MessageScroll: FC<OwnProps> = ({
  containerRef,
  className,
  messageIds,
  containerHeight,
  listItemElementsRef,
  focusingId,
  anchorIdRef,
  anchorTopRef,
  loadMoreForwards,
  loadMoreBackwards,
  isViewportNewest,
  firstUnreadId,
  onFabToggle,
  children,
}) => {
  // eslint-disable-next-line no-null/no-null
  const backwardsTriggerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const forwardsTriggerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const fabTriggerRef = useRef<HTMLDivElement>(null);

  const updateFabVisibility = useCallback(() => {
    if (!messageIds || !messageIds.length) {
      onFabToggle(false);
      return;
    }

    if (!isViewportNewest) {
      onFabToggle(true);
      return;
    }

    const { offsetHeight, scrollHeight, scrollTop } = containerRef.current!;
    const scrollBottom = scrollHeight - scrollTop - offsetHeight;
    const isNearBottom = scrollBottom <= FAB_THRESHOLD;
    const isAtBottom = scrollBottom === 0;

    onFabToggle(firstUnreadId ? !isAtBottom : !isNearBottom);
  }, [messageIds, isViewportNewest, containerRef, onFabToggle, firstUnreadId]);

  const { observe: observeIntersection, freeze, unfreeze } = useIntersectionObserver({
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
    } else if (target.className === 'forwards-trigger' && (target as HTMLDivElement).dataset.isActive) {
      resetScroll(containerRef.current!);
      loadMoreForwards();
    }
  });

  useOnChange(() => {
    if (focusingId) {
      freeze();
    } else {
      unfreeze();
    }
  }, [focusingId]);

  useOnIntersect(backwardsTriggerRef, observeIntersection);
  useOnIntersect(forwardsTriggerRef, observeIntersection);

  const { observe: observeIntersectionForFab } = useIntersectionObserver({
    rootRef: containerRef,
    margin: FAB_THRESHOLD,
  }, ([{ target }]) => {
    if ((target as HTMLDivElement).dataset.isActive) {
      updateFabVisibility();
    }
  });

  useOnIntersect(fabTriggerRef, observeIntersectionForFab);

  useOnChange(() => {
    if (!listItemElementsRef.current) {
      return;
    }

    const preservedItemElements = listItemElementsRef.current
      .filter((element) => messageIds.includes(Number(element.dataset.messageId)));

    // We avoid the very first item as it may be a partly-loaded album
    // and also because it may be removed when messages limit is reached
    const anchor = preservedItemElements[1] || preservedItemElements[0];
    if (!anchor) {
      return;
    }

    anchorIdRef.current = anchor.id;
    anchorTopRef.current = anchor.getBoundingClientRect().top;
  }, [messageIds, containerHeight]);

  return (
    <div className={className} teactFastList>
      <div ref={backwardsTriggerRef} key="backwards-trigger" className="backwards-trigger" />
      {children}
      <div
        ref={forwardsTriggerRef}
        key="forwards-trigger"
        className="forwards-trigger"
        data-is-active={!isViewportNewest}
      />
      <div
        ref={fabTriggerRef}
        key="fab-trigger"
        className="fab-trigger"
        data-is-active={isViewportNewest}
      />
    </div>
  );
};

export default MessageScroll;
