import { DEBUG } from '../../config';
import { createSignal } from '../../util/signals';

// Once the device cannot keep up, 3D diamonds not drawn yet give way to their Lottie animation until a reload
const [getIsDiamond3dDegradedLocal, setIsDiamond3dDegraded] = createSignal(false);
export const getIsDiamond3dDegraded = getIsDiamond3dDegradedLocal;

const WARM_UP_DURATION = 1000;
const WINDOW_DURATION = 2000;
// Below 20 frames per second
const MAX_MEDIAN_FRAME_INTERVAL = 50;
// A longer gap is a pause the renderer was not told about, such as a hidden window
const MAX_FRAME_INTERVAL = 1000;

export function markDiamond3dDegraded(reason: string) {
  if (getIsDiamond3dDegraded()) return;

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.warn(`[diamond] Falling back to Lottie: ${reason}`);
  }

  setIsDiamond3dDegraded(true);
}

// Frame intervals grow when the GPU or the main thread cannot keep up, whatever the cause
export function createFrameWatchdog() {
  let lastTime: number | undefined;
  let windowStart = 0;
  let intervals: number[] = [];

  function reset() {
    lastTime = undefined;
    intervals = [];
  }

  function track(now: number) {
    if (lastTime === undefined || now - lastTime > MAX_FRAME_INTERVAL) {
      lastTime = now;
      windowStart = now + WARM_UP_DURATION;
      intervals = [];
      return;
    }

    const interval = now - lastTime;
    lastTime = now;

    if (now < windowStart) return;

    intervals.push(interval);

    if (now - windowStart < WINDOW_DURATION) return;

    const median = getMedian(intervals);
    intervals = [];
    windowStart = now;

    if (median > MAX_MEDIAN_FRAME_INTERVAL) {
      markDiamond3dDegraded(`median frame interval ${Math.round(median)} ms`);
    }
  }

  return { track, reset };
}

function getMedian(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);

  return sorted[Math.floor(sorted.length / 2)];
}
