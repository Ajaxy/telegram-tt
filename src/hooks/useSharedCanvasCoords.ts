import {
  useCallback, useEffect, useMemo, useState,
} from '../lib/teact/teact';
import { throttle } from '../util/schedulers';
import { round } from '../util/math';

export default function useSharedCanvasCoords(
  containerRef: React.RefObject<HTMLDivElement>,
  sharedCanvasRef?: React.RefObject<HTMLCanvasElement>,
) {
  const [x, setX] = useState<number>();
  const [y, setY] = useState<number>();

  const recalculate = useCallback(() => {
    const container = containerRef.current;
    const canvas = sharedCanvasRef?.current;
    if (!container || !canvas) {
      return;
    }

    const target = container.classList.contains('sticker-set-cover') ? container : container.querySelector('img')!;
    const targetBounds = target.getBoundingClientRect();
    const canvasBounds = canvas.getBoundingClientRect();

    // Factor coords are used to support rendering while being rescaled (e.g. message appearance animation)
    setX(round((targetBounds.left - canvasBounds.left) / canvasBounds.width, 4));
    setY(round((targetBounds.top - canvasBounds.top) / canvasBounds.height, 4));
  }, [containerRef, sharedCanvasRef]);

  useEffect(() => {
    if (!('ResizeObserver' in window) || !sharedCanvasRef?.current) {
      return undefined;
    }

    const observer = new ResizeObserver(throttle(([entry]) => {
      // During animation
      if (!(entry.target as HTMLCanvasElement).offsetParent) {
        return;
      }

      recalculate();
    }, 300, false));

    observer.observe(sharedCanvasRef.current);

    return () => {
      observer.disconnect();
    };
  }, [recalculate, sharedCanvasRef]);

  return useMemo(() => (x !== undefined && y !== undefined ? { x, y } : undefined), [x, y]);
}
