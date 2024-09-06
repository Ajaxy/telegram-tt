import { useLayoutEffect, useMemo, useRef } from '../lib/teact/teact';

import cycleRestrict from '../util/cycleRestrict';
import launchMediaWorkers, { MAX_WORKERS } from '../util/launchMediaWorkers';

const RADIUS = 7;

let lastWorkerIndex = -1;

export default function useOffscreenCanvasBlur(
  thumbData?: string, // data URI or blob URL
  isDisabled = false,
  radius = RADIUS,
) {
  // eslint-disable-next-line no-null/no-null
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerIndex = useMemo(() => cycleRestrict(MAX_WORKERS, ++lastWorkerIndex), []);
  const offscreenRef = useRef<OffscreenCanvas>();

  useLayoutEffect(() => {
    if (!thumbData || isDisabled || offscreenRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    offscreenRef.current = canvas.transferControlToOffscreen();

    const { connector } = launchMediaWorkers()[workerIndex];
    connector.request({
      name: 'blurThumb',
      args: [offscreenRef.current, thumbData, radius],
      transferables: [offscreenRef.current],
    });
  }, [thumbData, isDisabled, radius, workerIndex]);

  return canvasRef;
}
