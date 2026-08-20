import type { EmojiFitzModifier } from '../../util/emoji/skinTone';
import type { CancellableCallback } from '../../util/PostMessageConnector';

import { createWorkerInterface } from '../../util/createPostMessageInterface';
import wasmUrl from './tlottie.wasm?url';

// Raw wasm ABI from https://github.com/dkaraush/tlottie (`src/bindings/wasm.rs`)
interface TLottieExports {
  memory: WebAssembly.Memory;
  tlottie_alloc: (len: number) => number;
  tlottie_free: (ptr: number, len: number) => void;
  tlottie_new_with_options: (
    jsonPtr: number,
    jsonLen: number,
    fitzModifier: EmojiFitzModifier,
    replacementsPtr: number,
    replacementsLength: number,
  ) => number;
  tlottie_drop: (instance: number) => void;
  tlottie_frame_rate: (instance: number) => number;
  tlottie_frame_count: (instance: number) => number;
  tlottie_render: (
    instance: number, frame: number, width: number, height: number, antialias: number,
  ) => number;
  tlottie_render_alpha8_color: (
    instance: number, frame: number, width: number, height: number, antialias: number, color: number,
  ) => number;
}

const HIGH_PRIORITY_MAX_FPS = 60;
const LOW_PRIORITY_MAX_FPS = 30;
const RGBA_BYTES_PER_PIXEL = 4;

let tlottie: TLottieExports | undefined;
const tlottiePromise = loadTLottie().then((wasmExports) => {
  tlottie = wasmExports;
});

async function loadTLottie(): Promise<TLottieExports> {
  let result: WebAssembly.WebAssemblyInstantiatedSource;
  try {
    result = await WebAssembly.instantiateStreaming(fetch(wasmUrl), {});
  } catch (err) {
    // Fallback for servers not serving `application/wasm`
    const response = await fetch(wasmUrl);
    result = await WebAssembly.instantiate(await response.arrayBuffer(), {});
  }

  return result.instance.exports as unknown as TLottieExports;
}

const renderers = new Map<string, {
  imgSize: number;
  reduceFactor: number;
  instance: number;
  imageData: ImageData;
  customColor?: [number, number, number];
}>();
const rendererOperations = new Map<string, Promise<unknown>>();

async function init(
  key: string,
  tgsUrl: string,
  imgSize: number,
  isLowPriority: boolean,
  customColor: [number, number, number] | undefined,
  fitzModifier: EmojiFitzModifier | undefined,
  onInit: CancellableCallback,
) {
  if (!tlottie) {
    await tlottiePromise;
  }

  const animationData = await fetchAnimationData(tgsUrl);
  const instance = createInstance(animationData, fitzModifier);
  if (!instance) {
    return false;
  }

  const imageData = new ImageData(imgSize, imgSize);

  const { reduceFactor, msPerFrame, reducedFramesCount } = calcParams(instance, isLowPriority);

  renderers.set(key, {
    imgSize, reduceFactor, instance, imageData, customColor,
  });

  onInit(reduceFactor, msPerFrame, reducedFramesCount);
  return true;
}

async function changeData(
  key: string,
  tgsUrl: string,
  isLowPriority: boolean,
  fitzModifier: EmojiFitzModifier | undefined,
  onInit: CancellableCallback,
) {
  if (!tlottie) {
    await tlottiePromise;
  }

  const animationData = await fetchAnimationData(tgsUrl);
  const instance = createInstance(animationData, fitzModifier);
  if (!instance) {
    return false;
  }

  const renderer = renderers.get(key);
  if (!renderer) {
    tlottie!.tlottie_drop(instance);
    throw new Error('[TLottie] Renderer not found');
  }

  tlottie!.tlottie_drop(renderer.instance);
  renderer.instance = instance;

  const { reduceFactor, msPerFrame, reducedFramesCount } = calcParams(instance, isLowPriority);
  renderer.reduceFactor = reduceFactor;

  onInit(reduceFactor, msPerFrame, reducedFramesCount);
  return true;
}

async function fetchAnimationData(tgsUrl: string) {
  const response = await fetch(tgsUrl);
  const contentType = response.headers.get('Content-Type');

  // Support deprecated JSON format cached locally
  if (contentType?.startsWith('text/')) {
    return new Uint8Array(await response.arrayBuffer());
  }

  if (!response.body) {
    return new Uint8Array(0);
  }

  // Prefer native gzip decompression over library. This use case has ~same speed
  const decompressionStream = response.body.pipeThrough(new DecompressionStream('gzip'));
  const result = await new Response(decompressionStream).arrayBuffer();
  return new Uint8Array(result);
}

function createInstance(animationData: Uint8Array, fitzModifier?: EmojiFitzModifier) {
  const { length } = animationData;
  const jsonPtr = tlottie!.tlottie_alloc(length);
  if (!jsonPtr) {
    return undefined;
  }

  try {
    // Heap views must be re-derived after every exported call: memory growth detaches buffers
    new Uint8Array(tlottie!.memory.buffer).set(animationData, jsonPtr);
    const instance = tlottie!.tlottie_new_with_options(jsonPtr, length, fitzModifier || 0, 0, 0);
    return instance || undefined;
  } finally {
    tlottie!.tlottie_free(jsonPtr, length);
  }
}

function calcParams(instance: number, isLowPriority: boolean) {
  const framesCount = tlottie!.tlottie_frame_count(instance);
  const maxFps = isLowPriority ? LOW_PRIORITY_MAX_FPS : HIGH_PRIORITY_MAX_FPS;
  const sourceFps = tlottie!.tlottie_frame_rate(instance) || maxFps;
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
  if (!tlottie) {
    await tlottiePromise;
  }

  const {
    imgSize, reduceFactor, instance, imageData, customColor,
  } = renderers.get(key)!;

  const realIndex = frameIndex * reduceFactor;

  const pixelsPtr = customColor
    ? tlottie!.tlottie_render_alpha8_color(instance, realIndex, imgSize, imgSize, 1, packColor(customColor))
    : tlottie!.tlottie_render(instance, realIndex, imgSize, imgSize, 1);
  if (!pixelsPtr) {
    return;
  }

  imageData.data.set(new Uint8Array(tlottie!.memory.buffer, pixelsPtr, imgSize * imgSize * RGBA_BYTES_PER_PIXEL));

  const imageBitmap = await createImageBitmap(imageData);

  onProgress(frameIndex, imageBitmap);
}

function packColor([r, g, b]: [number, number, number]) {
  return (r << 16) | (g << 8) | b;
}

function destroy(key: string) {
  const renderer = renderers.get(key);
  if (!renderer) {
    return;
  }

  tlottie!.tlottie_drop(renderer.instance);
  renderers.delete(key);
}

function enqueueRendererOperation<Result>(key: string, operation: () => Result | Promise<Result>) {
  const previousOperation = rendererOperations.get(key) || Promise.resolve();
  const operationPromise = previousOperation.catch(() => undefined).then(operation);
  rendererOperations.set(key, operationPromise);

  void operationPromise.then(
    () => clearRendererOperation(key, operationPromise),
    () => clearRendererOperation(key, operationPromise),
  );

  return operationPromise;
}

function clearRendererOperation(key: string, operation: Promise<unknown>) {
  if (rendererOperations.get(key) === operation) {
    rendererOperations.delete(key);
  }
}

const api = {
  'tlottie:init': (...args: Parameters<typeof init>) => enqueueRendererOperation(args[0], () => init(...args)),
  'tlottie:changeData': (...args: Parameters<typeof changeData>) => (
    enqueueRendererOperation(args[0], () => changeData(...args))
  ),
  'tlottie:renderFrames': (...args: Parameters<typeof renderFrames>) => (
    enqueueRendererOperation(args[0], () => renderFrames(...args))
  ),
  'tlottie:destroy': (key: string) => enqueueRendererOperation(key, () => destroy(key)),
};

createWorkerInterface(api, 'media');

export type TLottieApi = typeof api;
