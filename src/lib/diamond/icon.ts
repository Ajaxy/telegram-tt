import type { GpuCanvas, GpuDrawGroup, GpuRenderer } from './gpu';
import type { DiamondDrawState } from './model';
import type { GpuDiamondTarget } from './sceneGpu';

import { timingFunctions } from '../../util/animation';
import { getOpenModalCount } from '../../util/openModals';
import { requestMutation } from '../fasterdom/fasterdom';
import { getIsHeavyAnimating } from '../teact/teact';
import {
  addGpuDrawGroup, beginGpuPass, createGpuCanvas, createGpuFrame, getCanUseGpu, removeGpuDrawGroup,
  requestGpuRenderer, updateGpuPlayback,
} from './gpu';
import { TURN_DURATION } from './model';
import { getIsDiamond3dDegraded } from './performance';

// The diamond icons of the chats, drawn with WebGPU straight into their canvases: all turn in step on one clock, and a
// held one gets a larger frame of its own. Without WebGPU, or when it cannot start, an icon falls back to Lottie.

type Interaction = {
  yaw: number;
  pitch: number;
  drawState: DiamondDrawState;
  release?: {
    startTime: number;
    yawOffset: number;
    pitchOffset: number;
    onEnd: NoneToVoidFunction;
  };
};

type Subscriber = {
  renderer: GpuRenderer;
  gpu: GpuCanvas;
  size: number;
  drawState: DiamondDrawState;
  isReady: boolean;
  isInDialog: boolean;
  interaction?: Interaction;
  onReady: NoneToVoidFunction;
  onFallback: NoneToVoidFunction;
};

const DIAMOND_ICON_ZOOM = 3;
const DIALOG_SELECTOR = 'dialog, [role="dialog"]';

// About 30 frames per second, as on Android
const MIN_FRAME_INTERVAL = 30;
// Up to 60 frames per second
const HELD_FRAME_INTERVAL = 9.5;
const TURN_SPEED = (2 * Math.PI) / TURN_DURATION;
const FULL_TURN = 2 * Math.PI;
// 0.8° per pixel, as on Android
const DRAG_SPEED = (0.8 * Math.PI) / 180;
const RELEASE_DURATION = 350;
// 300° per second with a 9° sway over 8 seconds, as on Android
const SPIN_SPEED = (300 * Math.PI) / 180;
const SPIN_SWAY = (9 * Math.PI) / 180;
const SPIN_SWAY_DURATION = 8;

const subscribers = new Map<HTMLCanvasElement, Subscriber>();
// The canvases waiting for the device, with their fallbacks
const pending = new Map<HTMLCanvasElement, NoneToVoidFunction>();
const visibleCanvases = new Set<HTMLCanvasElement>();
// Kept apart from the subscribers: the spin is set right after subscribing, while the canvas still waits for the device
const spinningCanvases = new Set<HTMLCanvasElement>();
let observer: IntersectionObserver | undefined;
// Seconds of the common clock
let time = 0;
// The icons that turn in step share one pose and, per canvas size, one frame that is drawn once and copied into each
type Common = {
  renderer: GpuRenderer;
  state: DiamondDrawState;
  frames: Map<number, { target: GpuDiamondTarget; texture: GPUTexture }>;
};

let common: Common | undefined;

// Like animated stickers: the icons stop during heavy animations
const group: GpuDrawGroup = {
  getMinInterval: getMinFrameInterval,
  getIsPlaying: getIsAnyIconDrawn,
  draw: drawIcons,
};

getIsDiamond3dDegraded.subscribe(() => {
  if (!getIsDiamond3dDegraded()) return;

  pending.forEach((onFallback) => onFallback());
  pending.clear();

  // A card already drawn keeps its last frame, so the diamond does not change under the eye
  subscribers.forEach(({ isReady, onFallback }) => {
    if (!isReady) onFallback();
  });
  subscribers.clear();
  visibleCanvases.clear();
  observer?.disconnect();
  common = undefined;
  removeGpuDrawGroup(group);
});
getIsHeavyAnimating.subscribe(updateGpuPlayback);
getOpenModalCount.subscribe(updateGpuPlayback);

export function subscribeDiamondIcon(
  canvas: HTMLCanvasElement,
  onReady: NoneToVoidFunction,
  onFallback: NoneToVoidFunction,
) {
  if (!getCanUseGpu()) {
    onFallback();

    return undefined;
  }

  pending.set(canvas, onFallback);

  void requestGpuRenderer().then((renderer) => {
    // The card may be gone already, or have fallen back with the others
    if (pending.get(canvas) !== onFallback) return;

    pending.delete(canvas);

    const gpu = renderer && createGpuCanvas(renderer, canvas, 'icon');
    if (!renderer || !gpu) {
      onFallback();
      return;
    }

    subscribers.set(canvas, {
      renderer,
      gpu,
      size: canvas.width,
      drawState: {},
      isReady: false,
      isInDialog: Boolean(canvas.closest(DIALOG_SELECTOR)),
      onReady,
      onFallback,
    });
    if (subscribers.size === 1) addGpuDrawGroup(group);
    getObserver().observe(canvas);
    updateGpuPlayback();
  });

  return () => {
    spinningCanvases.delete(canvas);
    if (pending.delete(canvas)) return;

    const subscriber = subscribers.get(canvas);
    if (!subscriber) return;

    subscribers.delete(canvas);
    visibleCanvases.delete(canvas);
    observer?.unobserve(canvas);
    subscriber.gpu.destroy();
    if (!subscribers.size) removeGpuDrawGroup(group);
    updateGpuPlayback();
  };
}

export function setDiamondIconSpin(canvas: HTMLCanvasElement, isSpinning: boolean) {
  if (isSpinning) {
    spinningCanvases.add(canvas);
  } else {
    spinningCanvases.delete(canvas);
  }
}

export function holdDiamondIcon(canvas: HTMLCanvasElement) {
  const subscriber = subscribers.get(canvas);
  if (!subscriber?.isReady) return false;

  if (subscriber.interaction) {
    subscriber.interaction.release = undefined;
  } else {
    const interaction: Interaction = { yaw: getCommonYaw(), pitch: 0, drawState: {} };
    subscriber.interaction = interaction;

    requestMutation(() => {
      if (subscriber.interaction !== interaction) return;

      canvas.width = subscriber.size * DIAMOND_ICON_ZOOM;
      canvas.height = subscriber.size * DIAMOND_ICON_ZOOM;
      // The resized canvas is blank until its next frame, so the held one is drawn at once
      drawNow(canvas, subscriber, interaction.drawState, interaction.yaw, interaction.pitch);
    });
  }

  updateGpuPlayback();

  return true;
}

export function turnDiamondIcon(canvas: HTMLCanvasElement, deltaX: number, deltaY: number) {
  const interaction = subscribers.get(canvas)?.interaction;
  if (!interaction || interaction.release) return;

  interaction.yaw += deltaX * DRAG_SPEED;
  interaction.pitch += deltaY * DRAG_SPEED;
}

export function releaseDiamondIcon(canvas: HTMLCanvasElement, onEnd: NoneToVoidFunction) {
  const interaction = subscribers.get(canvas)?.interaction;
  if (!interaction) {
    onEnd();
    return;
  }

  const yawOffset = interaction.yaw - getCommonYaw();

  interaction.release = {
    startTime: performance.now(),
    yawOffset: yawOffset - Math.round(yawOffset / FULL_TURN) * FULL_TURN,
    pitchOffset: interaction.pitch,
    onEnd,
  };
}

function drawIcons(encoder: GPUCommandEncoder, frameTime: number, now: number) {
  time += frameTime;

  const spinYaw = time * SPIN_SPEED;
  const spinPitch = SPIN_SWAY * Math.sin((2 * Math.PI * time) / SPIN_SWAY_DURATION);
  const commonCanvases: HTMLCanvasElement[] = [];

  subscribers.forEach((subscriber, canvas) => {
    if (subscriber.interaction) {
      drawHeld(encoder, canvas, subscriber, now, frameTime);
      return;
    }

    if (!visibleCanvases.has(canvas) || getIsCovered(subscriber)) return;

    if (!spinningCanvases.has(canvas)) {
      commonCanvases.push(canvas);
      return;
    }

    drawCanvas(encoder, canvas, subscriber, subscriber.drawState, spinYaw, spinPitch, frameTime);
    markReady(subscriber);
  });

  if (commonCanvases.length) drawCommon(encoder, commonCanvases, frameTime);
}

// The common pose is solved once a frame and drawn once per canvas size; every icon only takes a copy of its frame
function drawCommon(encoder: GPUCommandEncoder, canvases: HTMLCanvasElement[], frameTime: number) {
  const { renderer } = subscribers.get(canvases[0])!;
  const { scene } = renderer;

  if (common?.renderer !== renderer) {
    common = { renderer, state: {}, frames: new Map() };
  }

  const { frames } = common;
  const pose = scene.solve(common.state, time, frameTime, getCommonYaw(), 0);
  const sizes = new Set(canvases.map((canvas) => canvas.width));

  sizes.forEach((size) => {
    let frame = frames.get(size);
    if (!frame) {
      frame = { target: scene.createTarget('icon'), texture: createGpuFrame(renderer, size) };
      frames.set(size, frame);
    }

    const viewport = { x: 0, y: 0, size };
    scene.writeTarget(frame.target, pose, viewport, time);
    const pass = beginGpuPass(renderer, encoder, frame.texture);
    scene.encode(pass, frame.target, viewport);
    pass.end();
  });

  canvases.forEach((canvas) => {
    const subscriber = subscribers.get(canvas)!;
    subscriber.gpu.copyFrom(encoder, frames.get(canvas.width)!.texture);
    markReady(subscriber);
  });
}

function drawHeld(
  encoder: GPUCommandEncoder, canvas: HTMLCanvasElement, subscriber: Subscriber, now: number, frameTime: number,
) {
  const interaction = subscriber.interaction!;
  const { release } = interaction;

  if (release) {
    const progress = Math.min(1, (now - release.startTime) / RELEASE_DURATION);

    if (progress >= 1) {
      subscriber.interaction = undefined;

      requestMutation(() => {
        if (!subscribers.has(canvas) || subscriber.interaction) return;

        canvas.width = subscriber.size;
        canvas.height = subscriber.size;
        drawNow(canvas, subscriber, subscriber.drawState, getCommonYaw(), 0);
        release.onEnd();
      });
      return;
    }

    const remaining = 1 - timingFunctions.easeOutQuint(progress);
    interaction.yaw = getCommonYaw() + release.yawOffset * remaining;
    interaction.pitch = release.pitchOffset * remaining;
  }

  drawCanvas(encoder, canvas, subscriber, interaction.drawState, interaction.yaw, interaction.pitch, frameTime);
}

function drawCanvas(
  encoder: GPUCommandEncoder, canvas: HTMLCanvasElement, subscriber: Subscriber, state: DiamondDrawState,
  yaw: number, pitch: number, frameTime: number,
) {
  const pass = subscriber.gpu.beginPass(encoder);
  subscriber.renderer.scene.draw(
    pass, subscriber.gpu.sceneTarget, state, { x: 0, y: 0, size: canvas.width }, time, frameTime, yaw, pitch,
  );
  pass.end();
}

// A frame outside the loop, with the step of a frame at rest
function drawNow(
  canvas: HTMLCanvasElement, subscriber: Subscriber, state: DiamondDrawState, yaw: number, pitch: number,
) {
  const { device } = subscriber.renderer;
  const encoder = device.createCommandEncoder();
  drawCanvas(encoder, canvas, subscriber, state, yaw, pitch, MIN_FRAME_INTERVAL / 1000);
  device.queue.submit([encoder.finish()]);
}

function markReady(subscriber: Subscriber) {
  if (subscriber.isReady) return;

  subscriber.isReady = true;
  subscriber.onReady();
}

// Loops rather than arrays: both run on every animation frame
function getMinFrameInterval() {
  for (const [canvas, { interaction }] of subscribers) {
    if (interaction || spinningCanvases.has(canvas)) return HELD_FRAME_INTERVAL;
  }

  return MIN_FRAME_INTERVAL;
}

function getIsAnyIconDrawn() {
  if (getIsHeavyAnimating()) return false;

  for (const [canvas, subscriber] of subscribers) {
    if (subscriber.interaction || (visibleCanvases.has(canvas) && !getIsCovered(subscriber))) return true;
  }

  return false;
}

// Dialogs open in portals, so a canvas sits in one at most, and only the dialogs above it cover it
function getIsCovered({ isInDialog }: Subscriber) {
  return getOpenModalCount() > (isInDialog ? 1 : 0);
}

function getCommonYaw() {
  return time * TURN_SPEED;
}

// A card scrolled away is clipped by the list and a slide left behind by `Transition` is hidden, so neither intersects
// the viewport
function getObserver() {
  observer ??= new IntersectionObserver((observed) => {
    observed.forEach(({ target, isIntersecting }) => {
      const canvas = target as HTMLCanvasElement;

      if (isIntersecting) {
        visibleCanvases.add(canvas);
      } else {
        visibleCanvases.delete(canvas);
      }
    });

    updateGpuPlayback();
  });

  return observer;
}
