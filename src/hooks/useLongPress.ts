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
  const isLongPressActiveRef = useRef(false);
  const isPressedRef = useRef(false);
  const timerIdRef = useRef<number | undefined>(undefined);

  const start = useLastCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canProcessEvent = ('button' in e && e.button === 0) || ('touches' in e && e.touches.length > 0);
    if (isPressedRef.current || !canProcessEvent) {
      return;
    }

    isPressedRef.current = true;
    timerIdRef.current = window.setTimeout(() => {
      onStart?.();
      isLongPressActiveRef.current = true;
    }, threshold);
  });

  const end = useLastCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isPressedRef.current) return;

    if (isLongPressActiveRef.current) {
      onEnd?.();
    } else {
      onClick?.(e);
    }

    cancel();
  });

  const cancel = useLastCallback(() => {
    isLongPressActiveRef.current = false;
    isPressedRef.current = false;
    window.clearTimeout(timerIdRef.current);
  });

  useUnmountCleanup(() => {
    window.clearTimeout(timerIdRef.current);
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
