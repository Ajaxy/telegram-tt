import { beginHeavyAnimation, useRef } from '../lib/teact/teact';
import { getActions } from '../global';

import { isAnimatingScroll } from '../util/animateScroll';
import useLastCallback from './useLastCallback';
import useResizeObserver from './useResizeObserver';
import useThrottledCallback from './useThrottledCallback';

const BOTTOM_FOCUS_SCROLL_THRESHOLD = 5;
const THROTTLE_MS = 300;
const RESIZE_ANIMATION_DURATION = 400;

function useMessageResizeObserver(
  ref: React.RefObject<HTMLElement> | undefined,
  shouldFocusOnResize = false,
) {
  const {
    focusLastMessage,
  } = getActions();
  const messageHeightRef = useRef(0);

  const handleResize = useLastCallback(
    (entry) => {
      const lastHeight = messageHeightRef.current;

      const newHeight = entry.contentRect.height;
      messageHeightRef.current = newHeight;

      if (isAnimatingScroll() || !lastHeight || newHeight <= lastHeight) return;

      const container = entry.target.closest('.MessageList');
      if (!container) return;

      beginHeavyAnimation(RESIZE_ANIMATION_DURATION);

      const resizeDiff = newHeight - lastHeight;
      const { offsetHeight, scrollHeight, scrollTop } = container;
      const currentScrollBottom = Math.round(scrollHeight - scrollTop - offsetHeight);
      const previousScrollBottom = currentScrollBottom - resizeDiff;

      if (previousScrollBottom <= BOTTOM_FOCUS_SCROLL_THRESHOLD) {
        focusLastMessage();
      }
    },
  );

  const throttledResize = useThrottledCallback(handleResize, [handleResize], THROTTLE_MS, false);

  useResizeObserver(ref, throttledResize, !shouldFocusOnResize);
}

export default useMessageResizeObserver;
