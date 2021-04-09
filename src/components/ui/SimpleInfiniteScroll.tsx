import { RefObject, UIEvent } from 'react';
import { LoadMoreDirection } from '../../types';

import React, {
  FC, useCallback, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';

import { debounce } from '../../util/schedulers';

type OwnProps = {
  ref?: RefObject<HTMLDivElement>;
  className?: string;
  onLoadMore: ({ direction }: { direction: LoadMoreDirection }) => void;
  onScroll?: (e: UIEvent<HTMLDivElement>) => void;
  items: any[];
  sensitiveArea?: number;
  preloadBackwards?: number;
  children: any;
};

const DEFAULT_SENSITIVE_AREA = 1200;
const DEFAULT_PRELOAD_BACKWARDS = 20;

const SimpleInfiniteScroll: FC<OwnProps> = ({
  ref,
  className,
  onLoadMore,
  onScroll,
  items,
  sensitiveArea = DEFAULT_SENSITIVE_AREA,
  preloadBackwards = DEFAULT_PRELOAD_BACKWARDS,
  children,
}: OwnProps) => {
  // eslint-disable-next-line no-null/no-null
  let containerRef = useRef<HTMLDivElement>(null);
  if (ref) {
    containerRef = ref;
  }

  // eslint-disable-next-line no-null/no-null
  const anchorTopRef = useRef<number>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onLoadMoreDebounced = useMemo(() => debounce(onLoadMore, 1000, true, false), [onLoadMore, items]);

  useEffect(() => {
    if (!items || items.length < preloadBackwards) {
      onLoadMoreDebounced({ direction: LoadMoreDirection.Backwards });
    }
  }, [items, onLoadMoreDebounced, preloadBackwards]);

  const handleScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    if (onScroll) {
      onScroll(e);
    }
    const container = e.target as HTMLElement;
    const anchor = container.firstElementChild;
    if (!anchor) {
      return;
    }

    const { scrollTop, scrollHeight, offsetHeight } = container;
    const newAnchorTop = anchor.getBoundingClientRect().top;
    const isNearBottom = scrollHeight - (scrollTop + offsetHeight) <= sensitiveArea;
    const isMovingDown = typeof anchorTopRef.current === 'number' && newAnchorTop < anchorTopRef.current;

    if (isNearBottom && isMovingDown) {
      onLoadMoreDebounced({ direction: LoadMoreDirection.Backwards });
    }

    anchorTopRef.current = newAnchorTop;
  }, [onLoadMoreDebounced, onScroll, sensitiveArea]);

  return (
    <div ref={containerRef} className={className} onScroll={handleScroll}>
      {children}
    </div>
  );
};

export default SimpleInfiniteScroll;
