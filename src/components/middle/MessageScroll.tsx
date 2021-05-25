import { MutableRefObject } from 'react';
import React, {
  FC, useCallback, useEffect, useRef,
} from '../../lib/teact/teact';

import { MESSAGE_LIST_SENSITIVE_AREA } from '../../config';
import { IS_SAFARI } from '../../util/environment';
import resetScroll from '../../util/resetScroll';
import { useIntersectionObserver, useOnIntersect } from '../../hooks/useIntersectionObserver';
import useOnChange from '../../hooks/useOnChange';

type OwnProps = {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  className: string;
  messageIds: number[];
  focusingId?: number;
  loadMoreForwards?: NoneToVoidFunction;
  loadMoreBackwards?: NoneToVoidFunction;
  isViewportNewest?: boolean;
  firstUnreadId?: number;
  onFabToggle: AnyToVoidFunction;
  children: any;
};

const FAB_THRESHOLD = 50;
const FAB_FREEZE_TIMEOUT = 100;

// Local flag is used because `freeze/unfreeze` methods are controlled by heavy animation
let isFabFrozen = false;

const MessageScroll: FC<OwnProps> = ({
  containerRef,
  className,
  messageIds,
  focusingId,
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
    if (isFabFrozen) {
      return;
    }

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
    const isAtBottom = scrollBottom === 0 || (IS_SAFARI && scrollBottom === 1);

    onFabToggle(firstUnreadId ? !isAtBottom : !isNearBottom);
  }, [messageIds, isViewportNewest, containerRef, onFabToggle, firstUnreadId]);

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
  }, () => {
    updateFabVisibility();
  });

  useOnIntersect(fabTriggerRef, observeIntersectionForFab);

  // Do not load more and show FAB when focusing
  useOnChange(() => {
    if (focusingId) {
      freezeForLoadMore();
      freezeForFab();
    } else {
      unfreezeForFab();
      unfreezeForLoadMore();
    }
  }, [focusingId]);

  // Workaround for FAB flickering with tall incoming message
  useOnChange(() => {
    isFabFrozen = true;

    setTimeout(() => {
      isFabFrozen = false;
    }, FAB_FREEZE_TIMEOUT);
  }, [messageIds]);

  // Workaround for stuck FAB when many unread messages
  useEffect(updateFabVisibility, [firstUnreadId]);

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
