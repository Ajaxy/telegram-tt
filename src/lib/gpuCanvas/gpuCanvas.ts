import type {
  GpuCanvasCommand, GpuCanvasKind, GpuCanvasWorkerMessage, SpoilerRect,
} from './types';

import { IS_TEST } from '../../config';
import { IS_MOBILE } from '../../util/browser/windowEnvironment';
import launchMediaWorkers from '../../util/launchMediaWorkers';
import { onIdle, throttleWithTickEnd } from '../../util/schedulers';
import { createSignal } from '../../util/signals';
import { getIsGpuAvailable } from '../gpu/device';

import { getIsInBackground } from '../../hooks/window/useBackgroundMode';

export type GpuCanvas = ReturnType<typeof createGpuCanvasHandle>;

// Rendering spoilers and custom emoji in a worker needs WebGPU there and a canvas it can take over
const IS_SUPPORTED = !IS_TEST && getIsGpuAvailable()
  && typeof HTMLCanvasElement.prototype.transferControlToOffscreen === 'function';

// Content keeps its fallback visuals until the worker reports it can draw
const [getIsGpuCanvasAvailableLocal, setIsGpuCanvasAvailable] = createSignal(false);
export const getIsGpuCanvasAvailable = getIsGpuCanvasAvailableLocal;

const canvases = new Map<Element, GpuCanvas>();

// Saves battery on high refresh rate phones
const MOBILE_MAX_FPS = 60;

let worker: Worker | undefined;
let intersectionObserver: IntersectionObserver | undefined;
let pendingCommands: GpuCanvasCommand[] = [];
let pendingTransferables: Transferable[] = [];
let lastId = 0;
let isAnimated = true;

const flushCommands = throttleWithTickEnd(() => {
  const commands = pendingCommands;
  const transferables = pendingTransferables;
  pendingCommands = [];
  pendingTransferables = [];
  ensureWorker().postMessage(commands, transferables);
});

export function createGpuCanvas(canvas: HTMLCanvasElement, kind: GpuCanvasKind) {
  const handle = createGpuCanvasHandle(canvas, kind);
  canvases.set(canvas, handle);
  ensureIntersectionObserver().observe(canvas);

  return handle;
}

export function getGpuCanvas(canvas: HTMLCanvasElement) {
  return canvases.get(canvas);
}

export function setGpuCanvasAnimated(isEnabled: boolean) {
  isAnimated = isEnabled;
  if (worker) sendPlayback();
}

export function clearGpuCanvasFrames(renderId: string, generation = Infinity) {
  if (!worker) return;

  sendCommand({ type: 'clearFrames', renderId, generation });
}

export function dropGpuCanvasFrame(renderId: string, frameIndex: number) {
  if (!worker) return;

  sendCommand({ type: 'dropFrame', renderId, frameIndex });
}

function createGpuCanvasHandle(canvas: HTMLCanvasElement, kind: GpuCanvasKind) {
  const id = ++lastId;
  // The browser mirrors the offscreen canvas size into the attributes of this element
  canvas.dataset.stricterdomIgnore = '';
  const offscreen = canvas.transferControlToOffscreen();
  sendCommand({
    type: 'create', id, canvas: offscreen, kind,
  }, [offscreen]);

  let lastSize: string | undefined;

  return {
    resize(width: number, height: number) {
      const dpr = window.devicePixelRatio;
      const size = `${width}x${height}@${dpr}`;
      if (size === lastSize) return;

      lastSize = size;
      sendCommand({
        type: 'resize', id, width, height, dpr,
      });
    },
    setSpoilers(rects: SpoilerRect[]) {
      sendCommand({ type: 'setSpoilers', id, rects });
    },
    reveal(x: number, y: number, glyphs?: ImageBitmap) {
      sendCommand({
        type: 'reveal', id, x, y, glyphs,
      }, glyphs && [glyphs]);
    },
    setEmoji(viewId: string, renderId: string, x: number, y: number, size: number) {
      sendCommand({
        type: 'setEmoji', id, viewId, renderId, x, y, size,
      });
    },
    drawEmoji(viewId: string, frameIndex: number) {
      sendCommand({ type: 'drawEmoji', id, viewId, frameIndex });
    },
    removeEmoji(viewId: string) {
      sendCommand({ type: 'removeEmoji', id, viewId });
    },
    destroy() {
      canvases.delete(canvas);
      intersectionObserver?.unobserve(canvas);
      sendCommand({ type: 'destroy', id });
    },
    setVisible(isVisible: boolean) {
      sendCommand({ type: 'setVisible', id, isVisible });
    },
  };
}

function sendCommand(command: GpuCanvasCommand, transferables?: Transferable[]) {
  pendingCommands.push(command);
  if (transferables) pendingTransferables.push(...transferables);
  flushCommands();
}

function ensureWorker() {
  if (worker) return worker;

  worker = new Worker(new URL('./gpuCanvas.worker.ts', import.meta.url), { type: 'module' });
  worker.addEventListener('message', ({ data }: MessageEvent<GpuCanvasWorkerMessage>) => {
    setIsGpuCanvasAvailable(data.type === 'ready');
  });
  // A failed chunk load or draw leaves the content without spoiler particles and emoji otherwise
  worker.addEventListener('error', () => setIsGpuCanvasAvailable(false));

  // Media workers send custom emoji frames to the canvas worker directly
  const commands: GpuCanvasCommand[] = [];
  const ports: Transferable[] = [];
  launchMediaWorkers().forEach(({ connector }) => {
    const channel = new MessageChannel();
    void connector.request({
      name: 'tlottie:connectGpuCanvas',
      args: [channel.port1],
      transferables: [channel.port1],
    });
    commands.push({ type: 'connectMediaWorker', port: channel.port2 });
    ports.push(channel.port2);
  });
  worker.postMessage(commands, ports);

  getIsInBackground.subscribe(sendPlayback);
  sendPlayback();

  return worker;
}

function sendPlayback() {
  sendCommand({
    type: 'setPlayback', isAnimated, isPaused: getIsInBackground(), maxFps: IS_MOBILE ? MOBILE_MAX_FPS : undefined,
  });
}

function ensureIntersectionObserver() {
  intersectionObserver ??= new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      canvases.get(target)?.setVisible(isIntersecting);
    });
  });

  return intersectionObserver;
}

if (IS_SUPPORTED) onIdle(ensureWorker);
