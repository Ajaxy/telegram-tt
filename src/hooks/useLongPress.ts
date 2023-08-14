import { useCallback, useEffect, useRef } from '../lib/teact/teact';

const DEFAULT_THRESHOLD = 250;

function useLongPress(
  onStart: NoneToVoidFunction,
  onEnd: NoneToVoidFunction,
) {
  const isLongPressActive = useRef(false);
  const isPressed = useRef(false);
  const timerId = useRef<number | undefined>(undefined);

  const start = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canProcessEvent = ('button' in e && e.button === 0) || ('touches' in e && e.touches.length > 0);
    if (isPressed.current || !canProcessEvent) {
      return;
    }

    isPressed.current = true;
    timerId.current = window.setTimeout(() => {
      onStart();
      isLongPressActive.current = true;
    }, DEFAULT_THRESHOLD);
  }, [onStart]);

  const cancel = useCallback(() => {
    if (isLongPressActive.current) {
      onEnd();
    }

    isLongPressActive.current = false;
    isPressed.current = false;
    window.clearTimeout(timerId.current);
  }, [onEnd]);

  useEffect(() => {
    return () => {
      window.clearTimeout(timerId.current);
    };
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: cancel,
  };
}

export default useLongPress;
