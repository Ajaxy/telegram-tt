import { useEffect, useRef } from '../lib/teact/teact';

import fastBlur from '../lib/fastBlur';
import useForceUpdate from './useForceUpdate';
import { IS_CANVAS_FILTER_SUPPORTED } from '../util/environment';

const RADIUS = 2;
const ITERATIONS = 2;

export default function useCanvasBlur(dataUri?: string, isDisabled = false, withRaf?: boolean) {
  // eslint-disable-next-line no-null/no-null
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const forceUpdate = useForceUpdate();

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!dataUri || !canvas || isDisabled) {
      return;
    }

    const img = new Image();

    const processBlur = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d', { alpha: false })!;

      if (IS_CANVAS_FILTER_SUPPORTED) {
        ctx.filter = `blur(${RADIUS}px)`;
      }

      ctx.drawImage(img, -RADIUS * 2, -RADIUS * 2, canvas.width + RADIUS * 4, canvas.height + RADIUS * 4);

      if (!IS_CANVAS_FILTER_SUPPORTED) {
        fastBlur(ctx, 0, 0, canvas.width, canvas.height, RADIUS, ITERATIONS);
      }
    };

    img.onload = () => {
      if (withRaf) {
        requestAnimationFrame(processBlur);
      } else {
        processBlur();
      }
    };

    img.src = dataUri;
  }, [canvasRef, dataUri, forceUpdate, isDisabled, withRaf]);

  return canvasRef;
}
