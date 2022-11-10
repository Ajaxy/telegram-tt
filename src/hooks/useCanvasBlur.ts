import { useEffect, useRef } from '../lib/teact/teact';

import { IS_CANVAS_FILTER_SUPPORTED } from '../util/environment';
import fastBlur from '../lib/fastBlur';

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
  const isStarted = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!dataUri || !canvas || isDisabled || isStarted.current) {
      return;
    }

    isStarted.current = true;

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
  }, [dataUri, isDisabled, preferredHeight, preferredWidth, radius, withRaf]);

  return canvasRef;
}
