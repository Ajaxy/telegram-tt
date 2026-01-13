import type { UIEvent } from 'react';
import type { ElementRef, FC } from '../../lib/teact/teact';
import type React from '../../lib/teact/teact';
import {
  useEffect, useLayoutEffect, useMemo, useRef,
} from '../../lib/teact/teact';

import { LoadMoreDirection } from '../../types';

import { requestForcedReflow } from '../../lib/fasterdom/fasterdom';
import { IS_ANDROID } from '../../util/browser/windowEnvironment';
import buildStyle from '../../util/buildStyle';
import resetScroll from '../../util/resetScroll';
import { debounce } from '../../util/schedulers';

import useLastCallback from '../../hooks/useLastCallback';

export type OwnProps = {
  ref?: ElementRef<HTMLDivElement>;
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
  scrollContainerClosest?: string;
  children: React.ReactNode;
  onLoadMore?: ({ direction }: { direction: LoadMoreDirection; noScroll?: boolean }) => void;
  onScroll?: (e: UIEvent<HTMLDivElement>) => void;
  onWheel?: (e: React.WheelEvent<HTMLDivElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<any>) => void;
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
  scrollContainerClosest,
  onLoadMore,
  onScroll,
  onWheel,
  onClick,
  onKeyDown,
}: OwnProps) => {
  let containerRef = useRef<HTMLDivElement>();
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
    const scrollContainer = scrollContainerClosest
      ? containerRef.current!.closest<HTMLDivElement>(scrollContainerClosest)!
      : containerRef.current!;
    if (!loadMoreBackwards || !scrollContainer) {
      return;
    }

    if (preloadBackwards > 0 && (!items || items.length < preloadBackwards)) {
      loadMoreBackwards(true);
      return;
    }

    const { scrollHeight, clientHeight } = scrollContainer;
    if (clientHeight && scrollHeight < clientHeight) {
      loadMoreBackwards();
    }
  }, [items, loadMoreBackwards, preloadBackwards, scrollContainerClosest]);

  // Restore `scrollTop` after adding items
  useLayoutEffect(() => {
    const scrollContainer = scrollContainerClosest
      ? containerRef.current!.closest<HTMLDivElement>(scrollContainerClosest)!
      : containerRef.current!;

    const container = containerRef.current!;

    requestForcedReflow(() => {
      const state = stateRef.current;

      state.listItemElements = container.querySelectorAll<HTMLDivElement>(itemSelector);

      let newScrollTop: number;

      if (state.currentAnchor && Array.from(state.listItemElements).includes(state.currentAnchor)) {
        const { scrollTop } = scrollContainer;
        const newAnchorTop = state.currentAnchor.getBoundingClientRect().top;
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

      const { scrollTop } = scrollContainer;
      if (noScrollRestoreOnTop && scrollTop === 0) {
        return undefined;
      }

      return () => {
        resetScroll(scrollContainer, newScrollTop);

        state.isScrollTopJustUpdated = true;
      };
    });
  }, [
    items, itemSelector, noScrollRestore, noScrollRestoreOnTop, cacheBuster, withAbsolutePositioning,
    scrollContainerClosest,
  ]);

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
      const scrollContainer = scrollContainerClosest
        ? containerRef.current!.closest<HTMLDivElement>(scrollContainerClosest)!
        : containerRef.current!;
      const { scrollTop, scrollHeight, offsetHeight } = scrollContainer;
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

  useLayoutEffect(() => {
    const scrollContainer = scrollContainerClosest
      ? containerRef.current!.closest<HTMLDivElement>(scrollContainerClosest)!
      : containerRef.current!;
    if (!scrollContainer) return undefined;

    const handleNativeScroll = (e: Event) => handleScroll(e as unknown as UIEvent<HTMLDivElement>);

    scrollContainer.addEventListener('scroll', handleNativeScroll);

    return () => {
      scrollContainer.removeEventListener('scroll', handleNativeScroll);
    };
  }, [handleScroll, scrollContainerClosest]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      teactFastList={!noFastList && !withAbsolutePositioning}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
    >
      {beforeChildren}
      {withAbsolutePositioning && items?.length ? (
        <div
          teactFastList={!noFastList}
          style={buildStyle('position: relative', IS_ANDROID && `height: ${maxHeight}px`)}
        >
          {children}
        </div>
      ) : children}
    </div>
  );
};

export default InfiniteScroll;
