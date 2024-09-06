import { useLayoutEffect, useMemo, useRef } from '../lib/teact/teact';

import cycleRestrict from '../util/cycleRestrict';
import launchMediaWorkers, { MAX_WORKERS } from '../util/launchMediaWorkers';

const RADIUS = 7;

let lastWorkerIndex = -1;

export default function useOffscreenCanvasBlur(
  dataUri?: string,
  isDisabled = false,
  radius = RADIUS,
) {
  // eslint-disable-next-line no-null/no-null
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerIndex = useMemo(() => cycleRestrict(MAX_WORKERS, ++lastWorkerIndex), []);

  useLayoutEffect(() => {
    if (!dataUri || isDisabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const offscreen = canvas.transferControlToOffscreen();

    const { connector } = launchMediaWorkers()[workerIndex];
    connector.request({
      name: 'blurThumb',
      args: [offscreen, dataUri, radius],
      transferables: [offscreen],
    });
  }, [dataUri, isDisabled, radius, workerIndex]);

  return canvasRef;
}
