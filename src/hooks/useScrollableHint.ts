import type { ElementRef } from '../lib/teact/teact';
import { useLayoutEffect } from '../lib/teact/teact';
import { addExtraClass, removeExtraClass, setExtraStyles } from '../lib/teact/teact-dom';

import { requestMeasure, requestMutation } from '../lib/fasterdom/fasterdom';
import useLastCallback from './useLastCallback';
import useResizeObserver from './useResizeObserver';
import useThrottledCallback from './useThrottledCallback';

type ScrollableHintState = {
  canScrollTop: boolean;
  canScrollBottom: boolean;
  canScrollLeft: boolean;
  canScrollRight: boolean;
};

type Options = {
  threshold?: number;
  isDisabled?: boolean;
};

const DEFAULT_THRESHOLD = 1;
const UPDATE_THROTTLE = 100;
const HINT_MASK_SIZE = 'var(--scrollable-hint-mask-size)';
const SCROLLABLE_HINT_CLASS_NAME = 'with-scrollable-hint';
const SCROLLABLE_OVERFLOW_VALUES = new Set(['auto', 'overlay', 'scroll']);

export default function useScrollableHint(
  containerRef: ElementRef<HTMLElement>,
  {
    threshold = DEFAULT_THRESHOLD,
    isDisabled = false,
  }: Options = {},
) {
  const applyScrollableHintThrottled = useThrottledCallback((element: HTMLElement) => {
    requestMeasure(() => {
      const state = measureScrollableHint(element, threshold);

      requestMutation(() => {
        applyScrollableHint(element, state);
      });
    });
  }, [threshold], UPDATE_THROTTLE);

  const updateScrollableHint = useLastCallback((element = containerRef.current) => {
    if (!element || isDisabled) {
      return;
    }

    applyScrollableHintThrottled(element);
  });

  const handleScroll = useLastCallback((event: Event | React.UIEvent<HTMLElement>) => {
    const element = event.currentTarget instanceof HTMLElement ? event.currentTarget : containerRef.current;
    updateScrollableHint(element);
  });

  useResizeObserver(containerRef, () => updateScrollableHint(), isDisabled);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return undefined;
    }

    if (isDisabled) {
      requestMutation(() => clearScrollableHint(element));
      return undefined;
    }

    updateScrollableHint(element);
    element.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      element.removeEventListener('scroll', handleScroll);
      requestMutation(() => clearScrollableHint(element));
    };
  }, [containerRef, handleScroll, isDisabled, threshold, updateScrollableHint]);

  return { handleScroll, updateScrollableHint };
}

function measureScrollableHint(
  element: HTMLElement,
  threshold: number,
): ScrollableHintState {
  const style = getComputedStyle(element);

  return {
    ...measureVerticalScrollableHint(element, threshold, style),
    ...measureHorizontalScrollableHint(element, threshold, style),
  };
}

function measureVerticalScrollableHint(
  element: HTMLElement,
  threshold: number,
  style: CSSStyleDeclaration,
): Pick<ScrollableHintState, 'canScrollTop' | 'canScrollBottom'> {
  if (!isScrollableOverflow(style.overflowY)) {
    return {
      canScrollTop: false,
      canScrollBottom: false,
    };
  }

  const maxScrollTop = element.scrollHeight - element.clientHeight;
  if (maxScrollTop <= threshold) {
    return {
      canScrollTop: false,
      canScrollBottom: false,
    };
  }

  return {
    canScrollTop: element.scrollTop > threshold,
    canScrollBottom: maxScrollTop - element.scrollTop > threshold,
  };
}

function measureHorizontalScrollableHint(
  element: HTMLElement,
  threshold: number,
  style: CSSStyleDeclaration,
): Pick<ScrollableHintState, 'canScrollLeft' | 'canScrollRight'> {
  if (!isScrollableOverflow(style.overflowX)) {
    return {
      canScrollLeft: false,
      canScrollRight: false,
    };
  }

  const maxScrollLeft = element.scrollWidth - element.clientWidth;
  if (maxScrollLeft <= threshold) {
    return {
      canScrollLeft: false,
      canScrollRight: false,
    };
  }

  const { scrollLeft } = element;
  const isRtl = style.direction === 'rtl';

  if (!isRtl) {
    return {
      canScrollLeft: scrollLeft > threshold,
      canScrollRight: maxScrollLeft - scrollLeft > threshold,
    };
  }

  if (scrollLeft < 0) {
    const absoluteScrollLeft = Math.abs(scrollLeft);

    return {
      canScrollLeft: maxScrollLeft - absoluteScrollLeft > threshold,
      canScrollRight: absoluteScrollLeft > threshold,
    };
  }

  return {
    canScrollLeft: scrollLeft > threshold,
    canScrollRight: maxScrollLeft - scrollLeft > threshold,
  };
}

function applyScrollableHint(
  element: HTMLElement,
  state: ScrollableHintState,
) {
  addExtraClass(element, SCROLLABLE_HINT_CLASS_NAME);
  setExtraStyles(element, {
    '--scrollable-hint-bottom-mask-outset': buildEdgeOutset(state.canScrollBottom),
    '--scrollable-hint-left-mask-outset': buildEdgeOutset(state.canScrollLeft),
    '--scrollable-hint-right-mask-outset': buildEdgeOutset(state.canScrollRight),
    '--scrollable-hint-top-mask-outset': buildEdgeOutset(state.canScrollTop),
  });
}

function clearScrollableHint(element: HTMLElement) {
  removeExtraClass(element, SCROLLABLE_HINT_CLASS_NAME);
  setExtraStyles(element, {
    '--scrollable-hint-bottom-mask-outset': '',
    '--scrollable-hint-left-mask-outset': '',
    '--scrollable-hint-right-mask-outset': '',
    '--scrollable-hint-top-mask-outset': '',
  });
}

function buildEdgeOutset(canScroll: boolean) {
  return canScroll ? '0px' : HINT_MASK_SIZE;
}

function isScrollableOverflow(overflow: string) {
  return SCROLLABLE_OVERFLOW_VALUES.has(overflow);
}
