import { useEffect, useRef } from '../lib/teact/teact';

import fastBlur from '../lib/fastBlur';
import { requestMeasure, requestMutation } from '../lib/fasterdom/fasterdom';
import { IS_CANVAS_FILTER_SUPPORTED } from '../util/windowEnvironment';
import useSyncEffect from './useSyncEffect';

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

  useSyncEffect(() => {
    if (!isDisabled) {
      isStarted.current = false;
    }
  }, [dataUri, isDisabled]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!dataUri || !canvas || isDisabled || isStarted.current) {
      return;
    }

    isStarted.current = true;

    const img = new Image();

    const processBlur = () => {
      const width = preferredWidth || img.width;
      const height = preferredHeight || img.height;
      const ctx = canvas.getContext('2d', { alpha: false })!;

      requestMutation(() => {
        canvas.width = width;
        canvas.height = height;

        if (IS_CANVAS_FILTER_SUPPORTED) {
          ctx.filter = `blur(${radius}px)`;
        }

        ctx.drawImage(img, -radius * 2, -radius * 2, width + radius * 4, height + radius * 4);

        if (!IS_CANVAS_FILTER_SUPPORTED) {
          fastBlur(ctx, 0, 0, width, height, radius, ITERATIONS);
        }
      });
    };

    img.onload = () => {
      if (withRaf) {
        requestMeasure(processBlur);
      } else {
        processBlur();
      }
    };

    img.src = dataUri;
  }, [dataUri, isDisabled, preferredHeight, preferredWidth, radius, withRaf]);

  return canvasRef;
}
