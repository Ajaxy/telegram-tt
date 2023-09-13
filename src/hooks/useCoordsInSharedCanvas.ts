import {
  useEffect, useMemo, useState,
} from '../lib/teact/teact';

import { round } from '../util/math';
import useLastCallback from './useLastCallback';
import useResizeObserver from './useResizeObserver';
import useSharedIntersectionObserver from './useSharedIntersectionObserver';
import useThrottledCallback from './useThrottledCallback';

const THROTTLE_MS = 150;

export default function useCoordsInSharedCanvas(
  containerRef: React.RefObject<HTMLDivElement>,
  sharedCanvasRef?: React.RefObject<HTMLCanvasElement>,
) {
  const [x, setX] = useState<number>();
  const [y, setY] = useState<number>();

  const recalculate = useLastCallback(() => {
    const container = containerRef.current;
    const canvas = sharedCanvasRef?.current;
    if (!container || !canvas) {
      return;
    }

    // Wait until elements are properly mounted
    if (!canvas.offsetWidth || !canvas.offsetHeight) {
      return;
    }

    const target = container.classList.contains('sticker-set-cover') || container.classList.contains('sticker-reaction')
      ? container
      : container.querySelector('img')!;
    if (!target) {
      return;
    }

    const targetBounds = target.getBoundingClientRect();
    const canvasBounds = canvas.getBoundingClientRect();

    // Factor coords are used to support rendering while being rescaled (e.g. message appearance animation)
    setX(round((targetBounds.left - canvasBounds.left) / canvasBounds.width, 4) || 0);
    setY(round((targetBounds.top - canvasBounds.top) / canvasBounds.height, 4) || 0);
  });

  useEffect(recalculate, [recalculate]);

  const throttledRecalculate = useThrottledCallback(recalculate, [recalculate], THROTTLE_MS);
  useResizeObserver(sharedCanvasRef, throttledRecalculate);
  useSharedIntersectionObserver(sharedCanvasRef, throttledRecalculate);

  return useMemo(() => (x !== undefined && y !== undefined ? { x, y } : undefined), [x, y]);
}
