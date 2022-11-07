import { useEffect, useRef } from '../lib/teact/teact';

import fastBlur from '../lib/fastBlur';
import useForceUpdate from './useForceUpdate';
import { IS_CANVAS_FILTER_SUPPORTED } from '../util/environment';

const RADIUS = 2;
const ITERATIONS = 2;

export default function useCanvasBlur(
  dataUri?: string,
  isDisabled = false,
  withRaf?: boolean,
  radius = RADIUS,
  preferredWidth?: number,
  preferredHeight?: number,
) {
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
      canvas.width = preferredWidth || img.width;
      canvas.height = preferredHeight || img.height;

      const ctx = canvas.getContext('2d', { alpha: false })!;

      if (IS_CANVAS_FILTER_SUPPORTED) {
        ctx.filter = `blur(${radius}px)`;
      }

      ctx.drawImage(img, -radius * 2, -radius * 2, canvas.width + radius * 4, canvas.height + radius * 4);

      if (!IS_CANVAS_FILTER_SUPPORTED) {
        fastBlur(ctx, 0, 0, canvas.width, canvas.height, radius, ITERATIONS);
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
  }, [canvasRef, dataUri, forceUpdate, isDisabled, preferredHeight, preferredWidth, withRaf, radius]);

  return canvasRef;
}
