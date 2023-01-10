import {
  useCallback, useLayoutEffect, useMemo, useState,
} from '../lib/teact/teact';

import { round } from '../util/math';

import { useResizeObserver } from './useResizeObserver';

const ANIMATION_END_TIMEOUT = 500;

export default function useBoundsInSharedCanvas(
  containerRef: React.RefObject<HTMLDivElement>,
  sharedCanvasRef?: React.RefObject<HTMLCanvasElement>,
) {
  const [x, setX] = useState<number>();
  const [y, setY] = useState<number>();
  const [size, setSize] = useState<number>();

  const recalculate = useCallback(() => {
    const container = containerRef.current;
    const canvas = sharedCanvasRef?.current;
    if (!container || !canvas) {
      return;
    }

    // Wait until elements are properly mounted
    if (!container.offsetParent || !canvas.offsetParent) {
      setTimeout(recalculate, ANIMATION_END_TIMEOUT);
      return;
    }

    const target = container.classList.contains('sticker-set-cover') ? container : container.querySelector('img')!;
    const targetBounds = target.getBoundingClientRect();
    const canvasBounds = canvas.getBoundingClientRect();

    // Factor coords are used to support rendering while being rescaled (e.g. message appearance animation)
    setX(round((targetBounds.left - canvasBounds.left) / canvasBounds.width, 4));
    setY(round((targetBounds.top - canvasBounds.top) / canvasBounds.height, 4));
    setSize(Math.round(targetBounds.width));
  }, [containerRef, sharedCanvasRef]);

  useLayoutEffect(recalculate, [recalculate]);

  useResizeObserver(sharedCanvasRef, recalculate, true);

  const coords = useMemo(() => (x !== undefined && y !== undefined ? { x, y } : undefined), [x, y]);

  return { coords, size };
}
