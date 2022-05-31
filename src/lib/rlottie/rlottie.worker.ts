import { inflate } from 'pako/dist/pako_inflate';
import createWorkerInterface from '../../util/createWorkerInterface';
import type { CancellableCallback } from '../../util/WorkerConnector';

declare const Module: any;

declare function allocate(...args: any[]): string;

declare function intArrayFromString(str: String): string;

declare const self: WorkerGlobalScope;

self.importScripts('rlottie-wasm.js');

let rLottieApi: Record<string, Function>;
const rLottieApiPromise = new Promise<void>((resolve) => {
  Module.onRuntimeInitialized = () => {
    rLottieApi = {
      init: Module.cwrap('lottie_init', '', []),
      destroy: Module.cwrap('lottie_destroy', '', ['number']),
      resize: Module.cwrap('lottie_resize', '', ['number', 'number', 'number']),
      buffer: Module.cwrap('lottie_buffer', 'number', ['number']),
      render: Module.cwrap('lottie_render', '', ['number', 'number']),
      loadFromData: Module.cwrap('lottie_load_from_data', 'number', ['number', 'number']),
    };

    resolve();
  };
});

const HIGH_PRIORITY_MAX_FPS = 60;
const LOW_PRIORITY_MAX_FPS = 30;

const renderers = new Map<string, {
  imgSize: number;
  reduceFactor: number;
  handle: any;
}>();

async function init(
  key: string,
  tgsUrl: string,
  imgSize: number,
  isLowPriority: boolean,
  onInit: CancellableCallback,
) {
  if (!rLottieApi) {
    await rLottieApiPromise;
  }

  const json = await extractJson(tgsUrl);
  const stringOnWasmHeap = allocate(intArrayFromString(json), 'i8', 0);
  const handle = rLottieApi.init();
  const framesCount = rLottieApi.loadFromData(handle, stringOnWasmHeap);
  rLottieApi.resize(handle, imgSize, imgSize);

  const { reduceFactor, msPerFrame, reducedFramesCount } = calcParams(json, isLowPriority, framesCount);

  renderers.set(key, { imgSize, reduceFactor, handle });
  onInit(reduceFactor, msPerFrame, reducedFramesCount);
}

async function changeData(
  key: string,
  tgsUrl: string,
  isLowPriority: boolean,
  onInit: CancellableCallback,
) {
  if (!rLottieApi) {
    await rLottieApiPromise;
  }

  const json = await extractJson(tgsUrl);
  const stringOnWasmHeap = allocate(intArrayFromString(json), 'i8', 0);
  const { handle } = renderers.get(key)!;
  const framesCount = rLottieApi.loadFromData(handle, stringOnWasmHeap);

  const { reduceFactor, msPerFrame, reducedFramesCount } = calcParams(json, isLowPriority, framesCount);
  onInit(reduceFactor, msPerFrame, reducedFramesCount);
}

async function extractJson(tgsUrl: string) {
  const response = await fetch(tgsUrl);
  const contentType = response.headers.get('Content-Type');

  // Support deprecated JSON format cached locally
  if (contentType?.startsWith('text/')) {
    return response.text();
  }

  const arrayBuffer = await response.arrayBuffer();
  return inflate(arrayBuffer, { to: 'string' });
}

function calcParams(json: string, isLowPriority: boolean, framesCount: number) {
  const animationData = JSON.parse(json);
  const maxFps = isLowPriority ? LOW_PRIORITY_MAX_FPS : HIGH_PRIORITY_MAX_FPS;
  const sourceFps = animationData.fr || maxFps;
  const reduceFactor = sourceFps % maxFps === 0 ? sourceFps / maxFps : 1;

  return {
    reduceFactor,
    msPerFrame: 1000 / (sourceFps / reduceFactor),
    reducedFramesCount: Math.ceil(framesCount / reduceFactor),
  };
}

async function renderFrames(
  key: string, fromIndex: number, toIndex: number, onProgress: CancellableCallback,
) {
  if (!rLottieApi) {
    await rLottieApiPromise;
  }

  const { imgSize, reduceFactor, handle } = renderers.get(key)!;

  for (let i = fromIndex; i <= toIndex; i++) {
    const realIndex = i * reduceFactor;

    rLottieApi.render(handle, realIndex);
    const bufferPointer = rLottieApi.buffer(handle);
    const data = Module.HEAPU8.subarray(bufferPointer, bufferPointer + (imgSize * imgSize * 4));
    const arrayBuffer = new Uint8ClampedArray(data).buffer;
    onProgress(i, arrayBuffer);
  }
}

function destroy(key: string) {
  const renderer = renderers.get(key)!;

  rLottieApi.destroy(renderer.handle);

  renderers.delete(key);
}

createWorkerInterface({
  init,
  changeData,
  renderFrames,
  destroy,
});
