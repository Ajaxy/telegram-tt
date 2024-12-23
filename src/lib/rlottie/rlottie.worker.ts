import { inflate } from 'pako/dist/pako_inflate';

import type { CancellableCallback } from '../../util/PostMessageConnector';

import { createWorkerInterface } from '../../util/createPostMessageInterface';

importScripts(new URL('./rlottie-wasm.js', import.meta.url));

declare const Module: any;

declare function allocate(...args: any[]): string;

declare function intArrayFromString(str: String): string;

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
const DESTROY_REPEAT_DELAY = 1000;

const renderers = new Map<string, {
  imgSize: number;
  reduceFactor: number;
  handle: any;
  imageData: ImageData;
  customColor?: [number, number, number];
}>();

async function init(
  key: string,
  tgsUrl: string,
  imgSize: number,
  isLowPriority: boolean,
  customColor: [number, number, number] | undefined,
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

  const imageData = new ImageData(imgSize, imgSize);

  const { reduceFactor, msPerFrame, reducedFramesCount } = calcParams(json, isLowPriority, framesCount);

  renderers.set(key, {
    imgSize, reduceFactor, handle, imageData, customColor,
  });

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
  key: string, frameIndex: number, onProgress: CancellableCallback,
) {
  if (!rLottieApi) {
    await rLottieApiPromise;
  }

  const {
    imgSize, reduceFactor, handle, imageData, customColor,
  } = renderers.get(key)!;

  const realIndex = frameIndex * reduceFactor;

  rLottieApi.render(handle, realIndex);
  const bufferPointer = rLottieApi.buffer(handle);
  const data = Module.HEAPU8.subarray(bufferPointer, bufferPointer + (imgSize * imgSize * 4));

  if (customColor) {
    const arr = new Uint8ClampedArray(data);
    applyColor(arr, customColor);
    imageData.data.set(arr);
  } else {
    imageData.data.set(data);
  }

  const imageBitmap = await createImageBitmap(imageData);

  onProgress(frameIndex, imageBitmap);
}

function applyColor(arr: Uint8ClampedArray, color: [number, number, number]) {
  for (let i = 0; i < arr.length; i += 4) {
    arr[i] = color[0];
    arr[i + 1] = color[1];
    arr[i + 2] = color[2];
  }
}

function destroy(key: string, isRepeated = false) {
  try {
    const renderer = renderers.get(key)!;
    rLottieApi.destroy(renderer.handle);
    renderers.delete(key);
  } catch (err) {
    // `destroy` sometimes can be called before the initialization is finished
    if (!isRepeated) {
      setTimeout(() => destroy(key, true), DESTROY_REPEAT_DELAY);
    }
  }
}

const api = {
  'rlottie:init': init,
  'rlottie:changeData': changeData,
  'rlottie:renderFrames': renderFrames,
  'rlottie:destroy': destroy,
};

createWorkerInterface(api, 'media');

export type RLottieApi = typeof api;
