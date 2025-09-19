import { useRef, useUnmountCleanup } from '../lib/teact/teact';

import useLastCallback from './useLastCallback';

const DEFAULT_THRESHOLD = 250;

function useLongPress({
  onClick, onStart, onEnd, threshold = DEFAULT_THRESHOLD,
}: {
  onStart?: NoneToVoidFunction;
  onClick?: (event: React.MouseEvent | React.TouchEvent) => void;
  onEnd?: NoneToVoidFunction;
  threshold?: number;
}) {
  const isLongPressActive = useRef(false);
  const isPressed = useRef(false);
  const timerId = useRef<number | undefined>(undefined);

  const start = useLastCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canProcessEvent = ('button' in e && e.button === 0) || ('touches' in e && e.touches.length > 0);
    if (isPressed.current || !canProcessEvent) {
      return;
    }

    isPressed.current = true;
    timerId.current = window.setTimeout(() => {
      onStart?.();
      isLongPressActive.current = true;
    }, threshold);
  });

  const end = useLastCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isPressed.current) return;

    if (isLongPressActive.current) {
      onEnd?.();
    } else {
      onClick?.(e);
    }

    cancel();
  });

  const cancel = useLastCallback(() => {
    isLongPressActive.current = false;
    isPressed.current = false;
    window.clearTimeout(timerId.current);
  });

  useUnmountCleanup(() => {
    window.clearTimeout(timerId.current);
  });

  return {
    onMouseDown: start,
    onMouseUp: end,
    onMouseLeave: end,
    onTouchStart: start,
    onTouchEnd: end,
  };
}

export default useLongPress;
