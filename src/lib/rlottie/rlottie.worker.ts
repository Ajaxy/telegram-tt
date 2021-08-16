import createWorkerInterface from '../../util/createWorkerInterface';
import { CancellableCallback } from '../../util/WorkerConnector';

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

const renderers = new Map<string, {
  imgSize: number;
  reduceFactor: number;
  handle: any;
}>();

async function init(
  key: string,
  animationData: AnyLiteral,
  imgSize: number,
  isLowPriority: boolean,
  reduceFactor: number,
  onInit: CancellableCallback,
) {
  if (!rLottieApi) {
    await rLottieApiPromise;
  }

  const json = JSON.stringify(animationData);
  const stringOnWasmHeap = allocate(intArrayFromString(json), 'i8', 0);
  const handle = rLottieApi.init();
  const framesCount = rLottieApi.loadFromData(handle, stringOnWasmHeap);
  rLottieApi.resize(handle, imgSize, imgSize);

  renderers.set(key, { imgSize, reduceFactor, handle });

  onInit(Math.ceil(framesCount / reduceFactor));
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
  renderFrames,
  destroy,
});
