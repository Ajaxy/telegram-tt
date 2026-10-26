import type { DiamondPalette } from './model';
import type { GpuDiamondScene, GpuDiamondTarget, GpuStarRenderer } from './sceneGpu';

import { getFrameTime, loadModel } from './model';
import { createFrameWatchdog, getIsDiamond3dDegraded, markDiamond3dDegraded } from './performance';
import {
  createGpuDiamondScene, createGpuStarRenderer, DEPTH_FORMAT, SAMPLE_COUNT,
} from './sceneGpu';

import { isPriorityPlaybackActive } from '../../hooks/usePriorityPlaybackCheck';
import { getIsInBackground } from '../../hooks/window/useBackgroundMode';

// One WebGPU device, scene and salute for every 3D diamond of the page. Each diamond draws straight into its canvas,
// and the groups that share a frame loop, the icons of the chats and the standalone diamonds, draw from here.

export type GpuRenderer = {
  device: GPUDevice;
  format: GPUTextureFormat;
  scene: GpuDiamondScene;
  stars: GpuStarRenderer;
};

export type GpuCanvas = {
  sceneTarget: GpuDiamondTarget;
  starTarget: GpuDiamondTarget;
  // Opens a pass that clears the canvas; the caller draws into it and ends it
  beginPass: (encoder: GPUCommandEncoder) => GPURenderPassEncoder;
  // Takes a frame drawn elsewhere, a texture of the canvas size in the canvas format
  copyFrom: (encoder: GPUCommandEncoder, frame: GPUTexture) => void;
  destroy: NoneToVoidFunction;
};

export type GpuDrawGroup = {
  // Milliseconds between frames
  getMinInterval: () => number;
  getIsPlaying: () => boolean;
  draw: (encoder: GPUCommandEncoder, frameTime: number, now: number) => void;
};

type Attachments = {
  textures: GPUTexture[];
  colorView: GPUTextureView;
  depthView: GPUTextureView;
};

const RELEASE_DELAY = 30000;

const groups = new Map<GpuDrawGroup, { lastFrameTime?: number }>();
const attachmentsBySize = new Map<string, Attachments>();
const watchdog = createFrameWatchdog();
let rendererPromise: Promise<GpuRenderer | undefined> | undefined;
let renderer: GpuRenderer | undefined;
// Set once WebGPU cannot start, so the diamonds fall back at once and do not ask again
let isUnavailable = false;
let canvasCount = 0;
let frameId: number | undefined;
let releaseTimeout: number | undefined;

getIsDiamond3dDegraded.subscribe(() => {
  if (getIsDiamond3dDegraded()) destroyRenderer();
});
getIsInBackground.subscribe(updateGpuPlayback);

export function getCanUseGpu() {
  return Boolean(navigator.gpu) && !isUnavailable && !getIsDiamond3dDegraded();
}

export function requestGpuRenderer(): Promise<GpuRenderer | undefined> {
  if (!getCanUseGpu()) return Promise.resolve(undefined);

  window.clearTimeout(releaseTimeout);
  releaseTimeout = undefined;
  rendererPromise ??= createRenderer();

  return rendererPromise;
}

async function createRenderer(): Promise<GpuRenderer | undefined> {
  try {
    await loadModel();
  } catch {
    markDiamond3dDegraded('cannot load the model');
    return undefined;
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    // A software adapter is far too slow for these shaders
    if (!adapter || adapter.info?.isFallbackAdapter) {
      isUnavailable = true;
      return undefined;
    }

    const device = await adapter.requestDevice();
    const format = navigator.gpu.getPreferredCanvasFormat();
    const [scene, stars] = await Promise.all([
      createGpuDiamondScene(device, format),
      createGpuStarRenderer(device, format),
    ]);

    // The diamonds gave up while the device started
    if (getIsDiamond3dDegraded()) {
      device.destroy();
      return undefined;
    }

    const current: GpuRenderer = {
      device, format, scene, stars,
    };

    void device.lost.then(({ reason }) => {
      if (reason !== 'destroyed' && renderer === current) markDiamond3dDegraded('WebGPU device lost');
    });

    renderer = current;
    scheduleRelease();

    return current;
  } catch {
    isUnavailable = true;
    return undefined;
  }
}

export function createGpuCanvas(
  current: GpuRenderer, canvas: HTMLCanvasElement, palette: DiamondPalette,
): GpuCanvas | undefined {
  const context = canvas.getContext('webgpu');
  if (!context) return undefined;

  const { device, format } = current;
  context.configure({
    device, format, alphaMode: 'premultiplied', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST,
  });
  const sceneTarget = current.scene.createTarget(palette);
  const starTarget = current.stars.createTarget();

  canvasCount++;
  window.clearTimeout(releaseTimeout);
  releaseTimeout = undefined;

  return {
    sceneTarget,
    starTarget,
    beginPass(encoder) {
      return beginGpuPass(current, encoder, context.getCurrentTexture());
    },
    copyFrom(encoder, frame) {
      encoder.copyTextureToTexture(
        { texture: frame }, { texture: context.getCurrentTexture() }, [canvas.width, canvas.height],
      );
    },
    destroy() {
      sceneTarget.buffer.destroy();
      starTarget.buffer.destroy();
      context.unconfigure();
      canvasCount--;
      scheduleRelease();
    },
  };
}

// Opens a pass that clears and draws into `target`, a texture in the canvas format
export function beginGpuPass(current: GpuRenderer, encoder: GPUCommandEncoder, target: GPUTexture) {
  const { colorView, depthView } = getAttachments(current, target.width, target.height);

  return encoder.beginRenderPass({
    colorAttachments: [{
      view: colorView,
      resolveTarget: target.createView(),
      clearValue: [0, 0, 0, 0],
      loadOp: 'clear',
      storeOp: 'discard',
    }],
    depthStencilAttachment: {
      view: depthView,
      depthClearValue: 1,
      depthLoadOp: 'clear',
      depthStoreOp: 'discard',
    },
  });
}

// A frame texture to copy into canvases of its size
export function createGpuFrame({ device, format }: GpuRenderer, size: number) {
  return device.createTexture({
    size: [size, size], format, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });
}

// The multisampled textures are cleared by every pass and resolved into the target, so targets of one size share them
function getAttachments({ device, format }: GpuRenderer, width: number, height: number): Attachments {
  const key = `${width}x${height}`;
  let attachments = attachmentsBySize.get(key);
  if (attachments) return attachments;

  const color = device.createTexture({
    size: [width, height], format, sampleCount: SAMPLE_COUNT, usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  const depth = device.createTexture({
    size: [width, height], format: DEPTH_FORMAT, sampleCount: SAMPLE_COUNT, usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  attachments = { textures: [color, depth], colorView: color.createView(), depthView: depth.createView() };
  attachmentsBySize.set(key, attachments);

  return attachments;
}

export function addGpuDrawGroup(group: GpuDrawGroup) {
  groups.set(group, {});
  updateGpuPlayback();
}

export function removeGpuDrawGroup(group: GpuDrawGroup) {
  groups.delete(group);
  updateGpuPlayback();
}

export function updateGpuPlayback() {
  if (!renderer) return;

  const isPlaying = !getIsInBackground() && [...groups.keys()].some((group) => group.getIsPlaying());

  if (isPlaying) {
    resume();
  } else {
    pause();
  }
}

function resume() {
  if (frameId !== undefined) return;

  groups.forEach((entry) => {
    entry.lastFrameTime = undefined;
  });
  watchdog.reset();
  frameId = requestAnimationFrame(renderFrame);
}

function pause() {
  if (frameId === undefined) return;

  cancelAnimationFrame(frameId);
  frameId = undefined;
}

function renderFrame(now: number) {
  frameId = requestAnimationFrame(renderFrame);

  if (isPriorityPlaybackActive()) {
    watchdog.reset();
    return;
  }

  watchdog.track(now);

  // The watchdog may have given up on the diamonds, which destroys the renderer
  const current = renderer;
  if (!current) return;

  const encoder = current.device.createCommandEncoder();
  let hasDrawn = false;

  groups.forEach((entry, group) => {
    if (!group.getIsPlaying()) return;
    if (entry.lastFrameTime !== undefined && now - entry.lastFrameTime < group.getMinInterval()) return;

    const frameTime = getFrameTime(now, entry.lastFrameTime);
    entry.lastFrameTime = now;
    group.draw(encoder, frameTime, now);
    hasDrawn = true;
  });

  if (hasDrawn) current.device.queue.submit([encoder.finish()]);
}

function scheduleRelease() {
  if (canvasCount || !rendererPromise) return;

  window.clearTimeout(releaseTimeout);
  releaseTimeout = window.setTimeout(destroyRenderer, RELEASE_DELAY);
}

function destroyRenderer() {
  window.clearTimeout(releaseTimeout);
  releaseTimeout = undefined;
  rendererPromise = undefined;
  if (!renderer) return;

  pause();
  attachmentsBySize.forEach(({ textures }) => textures.forEach((texture) => texture.destroy()));
  attachmentsBySize.clear();
  renderer.device.destroy();
  renderer = undefined;
}
