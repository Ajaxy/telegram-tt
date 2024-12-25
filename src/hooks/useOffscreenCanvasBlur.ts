import { useLayoutEffect, useMemo, useRef } from '../lib/teact/teact';

import { requestMutation } from '../lib/fasterdom/fasterdom';
import cycleRestrict from '../util/cycleRestrict';
import { preloadImage } from '../util/files';
import { MAX_WORKERS, requestMediaWorker } from '../util/launchMediaWorkers';
import useLastCallback from './useLastCallback';

const RADIUS_RATIO = 0.1; // Use 10% of the smallest dimension as the blur radius

let lastWorkerIndex = -1;

export default function useOffscreenCanvasBlur(
  thumbData?: string, // data URI or blob URL
  isDisabled = false,
) {
  // eslint-disable-next-line no-null/no-null
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerIndex = useMemo(() => cycleRestrict(MAX_WORKERS, ++lastWorkerIndex), []);
  const offscreenRef = useRef<OffscreenCanvas>();

  const blurThumb = useLastCallback(async (canvas: HTMLCanvasElement, uri: string) => {
    const image = await preloadImage(uri);
    if (!image) {
      return;
    }

    requestMutation(() => {
      canvas.width = image.width;
      canvas.height = image.height;

      offscreenRef.current = canvas.transferControlToOffscreen();

      const radius = Math.ceil(Math.min(image.width, image.height) * RADIUS_RATIO);

      requestMediaWorker({
        name: 'offscreen-canvas:blurThumb',
        args: [offscreenRef.current, uri, radius],
        transferables: [offscreenRef.current],
      }, workerIndex);
    });
  });

  useLayoutEffect(() => {
    if (!thumbData || isDisabled || offscreenRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    blurThumb(canvas, thumbData);
  }, [blurThumb, isDisabled, thumbData]);

  return canvasRef;
}
