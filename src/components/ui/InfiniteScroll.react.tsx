import type { RefObject, UIEvent } from 'react';
import React, {
  useEffect, useLayoutEffect, useMemo, useRef,
} from 'react';
import type { FC } from '../../lib/teact/teact';

import { LoadMoreDirection } from '../../types';

import { requestForcedReflow } from '../../lib/fasterdom/fasterdom';
import resetScroll from '../../util/resetScroll';
import { debounce } from '../../util/schedulers';
import { IS_ANDROID } from '../../util/windowEnvironment';

import useLastCallback from '../../hooks/useLastCallback.react';

type OwnProps = {
  ref?: RefObject<HTMLDivElement>;
  style?: string;
  className?: string;
  items?: any[];
  itemSelector?: string;
  preloadBackwards?: number;
  sensitiveArea?: number;
  withAbsolutePositioning?: boolean;
  maxHeight?: number;
  noScrollRestore?: boolean;
  noScrollRestoreOnTop?: boolean;
  noFastList?: boolean;
  cacheBuster?: any;
  beforeChildren?: React.ReactNode;
  children: React.ReactNode;
  onLoadMore?: ({ direction }: { direction: LoadMoreDirection; noScroll?: boolean }) => void;
  onScroll?: (e: UIEvent<HTMLDivElement>) => void;
  onWheel?: (e: React.WheelEvent<HTMLDivElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<any>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (e: React.DragEvent<HTMLDivElement>) => void;
};

const DEFAULT_LIST_SELECTOR = '.ListItem';
const DEFAULT_PRELOAD_BACKWARDS = 20;
const DEFAULT_SENSITIVE_AREA = 800;

const InfiniteScroll: FC<OwnProps> = ({
  ref,
  style,
  className,
  items,
  itemSelector = DEFAULT_LIST_SELECTOR,
  preloadBackwards = DEFAULT_PRELOAD_BACKWARDS,
  sensitiveArea = DEFAULT_SENSITIVE_AREA,
  withAbsolutePositioning,
  maxHeight,
  // Used to turn off restoring scroll position (e.g. for frequently re-ordered chat or user lists)
  noScrollRestore = false,
  noScrollRestoreOnTop = false,
  noFastList,
  // Used to re-query `listItemElements` if rendering is delayed by transition
  cacheBuster,
  beforeChildren,
  children,
  onLoadMore,
  onScroll,
  onWheel,
  onClick,
  onKeyDown,
  onDragOver,
  onDragLeave,
}: OwnProps) => {
  // eslint-disable-next-line no-null/no-null
  let containerRef = useRef<HTMLDivElement>(null);
  if (ref) {
    containerRef = ref;
  }

  const stateRef = useRef<{
    listItemElements?: NodeListOf<HTMLDivElement>;
    isScrollTopJustUpdated?: boolean;
    currentAnchor?: HTMLDivElement | undefined;
    currentAnchorTop?: number;
  }>({});

  const [loadMoreBackwards, loadMoreForwards] = useMemo(() => {
    if (!onLoadMore) {
      return [];
    }

    return [
      debounce((noScroll = false) => {
        onLoadMore({ direction: LoadMoreDirection.Backwards, noScroll });
      }, 1000, true, false),
      debounce(() => {
        onLoadMore({ direction: LoadMoreDirection.Forwards });
      }, 1000, true, false),
    ];
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [onLoadMore, items]);

  // Initial preload
  useEffect(() => {
    if (!loadMoreBackwards) {
      return;
    }

    if (preloadBackwards > 0 && (!items || items.length < preloadBackwards)) {
      loadMoreBackwards(true);
      return;
    }

    const { scrollHeight, clientHeight } = containerRef.current!;
    if (clientHeight && scrollHeight <= clientHeight) {
      loadMoreBackwards();
    }
  }, [items, loadMoreBackwards, preloadBackwards]);

  // Restore `scrollTop` after adding items
  useLayoutEffect(() => {
    requestForcedReflow(() => {
      const container = containerRef.current!;
      const state = stateRef.current;

      state.listItemElements = container.querySelectorAll<HTMLDivElement>(itemSelector);

      let newScrollTop: number;

      if (state.currentAnchor && Array.from(state.listItemElements).includes(state.currentAnchor)) {
        const { scrollTop } = container;
        const newAnchorTop = state.currentAnchor!.getBoundingClientRect().top;
        newScrollTop = scrollTop + (newAnchorTop - state.currentAnchorTop!);
      } else {
        const nextAnchor = state.listItemElements[0];
        if (nextAnchor) {
          state.currentAnchor = nextAnchor;
          state.currentAnchorTop = nextAnchor.getBoundingClientRect().top;
        }
      }

      if (withAbsolutePositioning || noScrollRestore) {
        return undefined;
      }

      const { scrollTop } = container;
      if (noScrollRestoreOnTop && scrollTop === 0) {
        return undefined;
      }

      return () => {
        resetScroll(container, newScrollTop);

        state.isScrollTopJustUpdated = true;
      };
    });
  }, [items, itemSelector, noScrollRestore, noScrollRestoreOnTop, cacheBuster, withAbsolutePositioning]);

  const handleScroll = useLastCallback((e: UIEvent<HTMLDivElement>) => {
    if (loadMoreForwards && loadMoreBackwards) {
      const {
        isScrollTopJustUpdated, currentAnchor, currentAnchorTop,
      } = stateRef.current;
      const listItemElements = stateRef.current.listItemElements!;

      if (isScrollTopJustUpdated) {
        stateRef.current.isScrollTopJustUpdated = false;
        return;
      }

      const listLength = listItemElements.length;
      const container = containerRef.current!;
      const { scrollTop, scrollHeight, offsetHeight } = container;
      const top = listLength ? listItemElements[0].offsetTop : 0;
      const isNearTop = scrollTop <= top + sensitiveArea;
      const bottom = listLength
        ? listItemElements[listLength - 1].offsetTop + listItemElements[listLength - 1].offsetHeight
        : scrollHeight;
      const isNearBottom = bottom - (scrollTop + offsetHeight) <= sensitiveArea;
      let isUpdated = false;

      if (isNearTop) {
        const nextAnchor = listItemElements[0];
        if (nextAnchor) {
          const nextAnchorTop = nextAnchor.getBoundingClientRect().top;
          const newAnchorTop = currentAnchor?.offsetParent && currentAnchor !== nextAnchor
            ? currentAnchor.getBoundingClientRect().top
            : nextAnchorTop;
          const isMovingUp = (
            currentAnchor && currentAnchorTop !== undefined && newAnchorTop > currentAnchorTop
          );

          if (isMovingUp) {
            stateRef.current.currentAnchor = nextAnchor;
            stateRef.current.currentAnchorTop = nextAnchorTop;
            isUpdated = true;
            loadMoreForwards();
          }
        }
      }

      if (isNearBottom) {
        const nextAnchor = listItemElements[listLength - 1];
        if (nextAnchor) {
          const nextAnchorTop = nextAnchor.getBoundingClientRect().top;
          const newAnchorTop = currentAnchor?.offsetParent && currentAnchor !== nextAnchor
            ? currentAnchor.getBoundingClientRect().top
            : nextAnchorTop;
          const isMovingDown = (
            currentAnchor && currentAnchorTop !== undefined && newAnchorTop < currentAnchorTop
          );

          if (isMovingDown) {
            stateRef.current.currentAnchor = nextAnchor;
            stateRef.current.currentAnchorTop = nextAnchorTop;
            isUpdated = true;
            loadMoreBackwards();
          }
        }
      }

      if (!isUpdated) {
        if (currentAnchor?.offsetParent) {
          stateRef.current.currentAnchorTop = currentAnchor.getBoundingClientRect().top;
        } else {
          const nextAnchor = listItemElements[0];

          if (nextAnchor) {
            stateRef.current.currentAnchor = nextAnchor;
            stateRef.current.currentAnchorTop = nextAnchor.getBoundingClientRect().top;
          }
        }
      }
    }

    if (onScroll) {
      onScroll(e);
    }
  });

  return (
    <div
      ref={containerRef}
      className={className}
      onScroll={handleScroll}
      onWheel={onWheel}
      teactFastList={!noFastList && !withAbsolutePositioning}
      onKeyDown={onKeyDown}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={onClick}
      style={style}
    >
      {beforeChildren}
      {withAbsolutePositioning && items?.length ? (
        <div
          // teactFastList={!noFastList}
          // @ts-ignore
          style={{ position: 'relative', height: IS_ANDROID ? `${maxHeight}px` : 'unset' }}
        >
          {children}
        </div>
      ) : children}
    </div>
  );
};

export default InfiniteScroll;
