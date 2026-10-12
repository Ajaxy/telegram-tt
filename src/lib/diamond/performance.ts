import { DEBUG } from '../../config';
import { createSignal } from '../../util/signals';

// Once the device cannot keep up, every 3D diamond gives way to its Lottie animation until a reload
const [getIsDiamond3dDegradedLocal, setIsDiamond3dDegraded] = createSignal(false);
export const getIsDiamond3dDegraded = getIsDiamond3dDegradedLocal;

const WARM_UP_DURATION = 1000;
const WINDOW_DURATION = 2000;
// Below 20 frames per second
const MAX_MEDIAN_FRAME_INTERVAL = 50;
// A longer gap is a pause the renderer was not told about, such as a hidden window
const MAX_FRAME_INTERVAL = 1000;
const GPU_SAMPLE_COUNT = 60;
const MAX_PENDING_QUERIES = 4;
const NANOSECONDS_IN_MILLISECOND = 1e6;

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

// Where the browser can measure it (mostly desktop Chrome); results come a few frames late
export function createGpuTimer(gl: WebGL2RenderingContext, maxMedianDuration: number) {
  const extension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if (!extension) return undefined;

  const pending: WebGLQuery[] = [];
  let samples: number[] = [];

  function measure(draw: NoneToVoidFunction) {
    collectResults();

    if (pending.length >= MAX_PENDING_QUERIES) {
      draw();
      return;
    }

    const query = gl.createQuery();
    gl.beginQuery(extension!.TIME_ELAPSED_EXT, query);
    draw();
    gl.endQuery(extension!.TIME_ELAPSED_EXT);
    pending.push(query);
  }

  function collectResults() {
    if (gl.getParameter(extension!.GPU_DISJOINT_EXT)) {
      pending.splice(0).forEach((query) => gl.deleteQuery(query));
      return;
    }

    while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
      const query = pending.shift()!;
      samples.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / NANOSECONDS_IN_MILLISECOND);
      gl.deleteQuery(query);
    }

    if (samples.length < GPU_SAMPLE_COUNT) return;

    const median = getMedian(samples);
    samples = [];

    if (median > maxMedianDuration) {
      markDiamond3dDegraded(`median GPU time ${median.toFixed(1)} ms`);
    }
  }

  return { measure };
}

function getMedian(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);

  return sorted[Math.floor(sorted.length / 2)];
}
