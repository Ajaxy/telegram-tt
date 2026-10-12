import type { DiamondDrawState, DiamondScene, DiamondViewport } from './scene';

import { timingFunctions } from '../../util/animation';
import { getOpenModalCount } from '../../util/openModals';
import { getIsHeavyAnimating, onFullyIdle } from '../teact/teact';
import {
  createFrameWatchdog, createGpuTimer, getIsDiamond3dDegraded, markDiamond3dDegraded,
} from './performance';
import { createDiamondScene, getFrameTime, TURN_DURATION } from './scene';

import { isPriorityPlaybackActive } from '../../hooks/usePriorityPlaybackCheck';
import { getIsInBackground } from '../../hooks/window/useBackgroundMode';

// One renderer draws the frame and every transfer card copies it, so all diamonds in a chat turn in step and
// there is one WebGL context. A held diamond gets a larger frame of its own in a second area.

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
  context: CanvasRenderingContext2D;
  size: number;
  isReady: boolean;
  isInDialog: boolean;
  interaction?: Interaction;
  onReady: NoneToVoidFunction;
  onFallback: NoneToVoidFunction;
};

type Renderer = {
  canvas: HTMLCanvasElement;
  iconSize: number;
  scene?: DiamondScene;
  gpuTimer?: ReturnType<typeof createGpuTimer>;
  watchdog: ReturnType<typeof createFrameWatchdog>;
  drawState: DiamondDrawState;
  spinDrawState: DiamondDrawState;
  frameId?: number;
  lastFrameTime?: number;
  time: number;
  hasFrame: boolean;
  destroy: NoneToVoidFunction;
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
// A device that needs more GPU time per frame is too slow for the chat
const MAX_GPU_FRAME_DURATION = 4;
const RELEASE_DELAY = 30000;

const subscribers = new Map<HTMLCanvasElement, Subscriber>();
const visibleCanvases = new Set<HTMLCanvasElement>();
const heldCanvases = new Set<HTMLCanvasElement>();
const spinningCanvases = new Set<HTMLCanvasElement>();
let observer: IntersectionObserver | undefined;
let renderer: Renderer | undefined;
let releaseTimeout: number | undefined;

getIsDiamond3dDegraded.subscribe(() => {
  if (!getIsDiamond3dDegraded()) return;

  destroyRenderer();
  subscribers.forEach(({ onFallback }) => onFallback());
});
getIsInBackground.subscribe(updatePlayback);
getIsHeavyAnimating.subscribe(updatePlayback);
getOpenModalCount.subscribe(updatePlayback);

export function subscribeDiamondIcon(
  canvas: HTMLCanvasElement,
  onReady: NoneToVoidFunction,
  onFallback: NoneToVoidFunction,
) {
  const context = canvas.getContext('2d');

  if (getIsDiamond3dDegraded() || !context) {
    onFallback();

    return undefined;
  }

  subscribers.set(canvas, {
    context,
    size: canvas.width,
    isReady: false,
    isInDialog: Boolean(canvas.closest(DIALOG_SELECTOR)),
    onReady,
    onFallback,
  });

  getObserver().observe(canvas);
  window.clearTimeout(releaseTimeout);
  releaseTimeout = undefined;
  renderer ??= createRenderer(canvas.width);

  return () => {
    subscribers.delete(canvas);
    visibleCanvases.delete(canvas);
    heldCanvases.delete(canvas);
    spinningCanvases.delete(canvas);
    observer?.unobserve(canvas);
    updatePlayback();

    if (!subscribers.size) {
      releaseTimeout = window.setTimeout(destroyRenderer, RELEASE_DELAY);
    }
  };
}

export function setDiamondIconSpin(canvas: HTMLCanvasElement, isSpinning: boolean) {
  if (!subscribers.has(canvas)) return;

  if (isSpinning) {
    spinningCanvases.add(canvas);
  } else {
    spinningCanvases.delete(canvas);
  }
}

export function holdDiamondIcon(canvas: HTMLCanvasElement) {
  const subscriber = subscribers.get(canvas);
  if (!subscriber || !renderer?.hasFrame) return false;

  if (subscriber.interaction) {
    subscriber.interaction.release = undefined;
  } else {
    subscriber.interaction = { yaw: getCommonYaw(renderer), pitch: 0, drawState: {} };
    canvas.width = subscriber.size * DIAMOND_ICON_ZOOM;
    canvas.height = subscriber.size * DIAMOND_ICON_ZOOM;

    // The common frame, scaled up, stands in until the held one is drawn
    copyFrame(canvas);
  }

  heldCanvases.add(canvas);
  updatePlayback();

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

  if (!interaction || !renderer) {
    onEnd();
    return;
  }

  const yawOffset = interaction.yaw - getCommonYaw(renderer);

  interaction.release = {
    startTime: performance.now(),
    yawOffset: yawOffset - Math.round(yawOffset / FULL_TURN) * FULL_TURN,
    pitchOffset: interaction.pitch,
    onEnd,
  };
}

function createRenderer(iconSize: number): Renderer {
  // The held frame fills the left square, the common frame takes the bottom right corner
  const canvas = document.createElement('canvas');
  canvas.width = iconSize * (DIAMOND_ICON_ZOOM + 1);
  canvas.height = iconSize * DIAMOND_ICON_ZOOM;

  let isDestroyed = false;
  const current: Renderer = {
    canvas,
    iconSize,
    watchdog: createFrameWatchdog(),
    drawState: {},
    spinDrawState: {},
    time: 0,
    hasFrame: false,
    destroy: () => {
      isDestroyed = true;
    },
  };

  // Creating a WebGL context blocks the main thread until the GPU process responds, so it waits for idle
  onFullyIdle(() => {
    if (isDestroyed) return;

    // The frame is copied into cards after drawing and when a card scrolls into view, so the buffer must persist
    const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true, preserveDrawingBuffer: true });

    if (!gl) {
      markDiamond3dDegraded('no hardware WebGL 2');
      return;
    }

    const handleContextLost = () => markDiamond3dDegraded('WebGL context lost');
    canvas.addEventListener('webglcontextlost', handleContextLost);

    current.destroy = () => {
      isDestroyed = true;
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };

    createDiamondScene(gl, 'icon')
      .then((scene) => {
        if (isDestroyed) return;

        current.scene = scene;
        current.gpuTimer = createGpuTimer(gl, MAX_GPU_FRAME_DURATION);
        updatePlayback();
      })
      .catch(() => {
        if (!isDestroyed) markDiamond3dDegraded('cannot load the model');
      });
  });

  return current;
}

function destroyRenderer() {
  if (!renderer) return;

  pause(renderer);
  renderer.destroy();
  renderer = undefined;
  heldCanvases.clear();
  spinningCanvases.clear();

  subscribers.forEach((subscriber) => {
    subscriber.interaction = undefined;
  });

  window.clearTimeout(releaseTimeout);
  releaseTimeout = undefined;
}

// Like animated stickers: stops in a background window, during heavy animations and while nothing shows it
function updatePlayback() {
  if (!renderer?.scene) return;

  const isShown = [...visibleCanvases, ...heldCanvases].some((canvas) => !getIsCovered(canvas));

  if (isShown && !getIsInBackground() && !getIsHeavyAnimating()) {
    resume(renderer);
  } else {
    pause(renderer);
  }
}

// Dialogs open in portals, so a canvas sits in one at most, and only the dialogs above it cover it
function getIsCovered(canvas: HTMLCanvasElement) {
  return getOpenModalCount() > (subscribers.get(canvas)!.isInDialog ? 1 : 0);
}

function resume(current: Renderer) {
  if (current.frameId !== undefined) return;

  current.lastFrameTime = undefined;
  current.watchdog.reset();
  current.frameId = requestAnimationFrame(renderFrame);
}

function pause(current: Renderer) {
  if (current.frameId === undefined) return;

  cancelAnimationFrame(current.frameId);
  current.frameId = undefined;
}

function renderFrame(now: number) {
  const current = renderer!;
  current.frameId = requestAnimationFrame(renderFrame);

  if (isPriorityPlaybackActive()) {
    current.watchdog.reset();
    return;
  }

  current.watchdog.track(now);

  // The watchdog may have given up on the diamond, which destroys this renderer
  if (renderer !== current) return;

  const minInterval = heldCanvases.size || spinningCanvases.size ? HELD_FRAME_INTERVAL : MIN_FRAME_INTERVAL;
  if (current.lastFrameTime !== undefined && now - current.lastFrameTime < minInterval) return;

  const frameTime = getFrameTime(now, current.lastFrameTime);
  current.lastFrameTime = now;
  current.time += frameTime;

  const {
    scene, gpuTimer, time, drawState,
  } = current;
  const commonYaw = getCommonYaw(current);
  const draw = () => scene!.draw(drawState, getCommonViewport(current), time, frameTime, commonYaw, 0);

  if (gpuTimer) {
    gpuTimer.measure(draw);

    if (renderer !== current) return;
  } else {
    draw();
  }

  current.hasFrame = true;

  if (spinningCanvases.size) drawSpinningFrame(current, frameTime);

  visibleCanvases.forEach((canvas) => {
    if (heldCanvases.has(canvas) || getIsCovered(canvas)) return;

    copyFrame(canvas, spinningCanvases.has(canvas));
  });

  heldCanvases.forEach((canvas) => drawHeldFrame(current, canvas, now, frameTime));
}

function drawSpinningFrame(current: Renderer, frameTime: number) {
  const { time, iconSize, canvas } = current;
  const yaw = time * SPIN_SPEED;
  const pitch = SPIN_SWAY * Math.sin((2 * Math.PI * time) / SPIN_SWAY_DURATION);

  current.scene!.draw(
    current.spinDrawState,
    { x: canvas.width - iconSize, y: iconSize, size: iconSize },
    time, frameTime, yaw, pitch,
  );
}

function drawHeldFrame(current: Renderer, canvas: HTMLCanvasElement, now: number, frameTime: number) {
  const subscriber = subscribers.get(canvas)!;
  const interaction = subscriber.interaction!;
  const { release } = interaction;

  if (release) {
    const progress = Math.min(1, (now - release.startTime) / RELEASE_DURATION);

    if (progress >= 1) {
      finishInteraction(canvas, subscriber, release.onEnd);
      return;
    }

    const remaining = 1 - timingFunctions.easeOutQuint(progress);
    interaction.yaw = getCommonYaw(current) + release.yawOffset * remaining;
    interaction.pitch = release.pitchOffset * remaining;
  }

  const size = current.iconSize * DIAMOND_ICON_ZOOM;

  current.scene!.draw(interaction.drawState, { x: 0, y: 0, size }, current.time, frameTime, interaction.yaw,
    interaction.pitch);

  subscriber.context.clearRect(0, 0, canvas.width, canvas.height);
  subscriber.context.drawImage(current.canvas, 0, 0, size, size, 0, 0, canvas.width, canvas.height);
}

function finishInteraction(canvas: HTMLCanvasElement, subscriber: Subscriber, onEnd: NoneToVoidFunction) {
  subscriber.interaction = undefined;
  heldCanvases.delete(canvas);
  canvas.width = subscriber.size;
  canvas.height = subscriber.size;
  copyFrame(canvas);
  onEnd();
}

function copyFrame(canvas: HTMLCanvasElement, isSpinning?: boolean) {
  const subscriber = subscribers.get(canvas);
  if (!subscriber || !renderer) return;

  const { context } = subscriber;
  const { canvas: source, iconSize } = renderer;

  // The buffer counts rows from the bottom; the spinning frame sits one square above the common one
  const sourceY = source.height - iconSize * (isSpinning ? 2 : 1);
  context.clearRect(0, 0, canvas.width, canvas.height);

  context.drawImage(
    source, source.width - iconSize, sourceY, iconSize, iconSize, 0, 0, canvas.width, canvas.height,
  );

  if (!subscriber.isReady) {
    subscriber.isReady = true;
    subscriber.onReady();
  }
}

function getCommonViewport({ canvas, iconSize }: Renderer): DiamondViewport {
  return { x: canvas.width - iconSize, y: 0, size: iconSize };
}

function getCommonYaw({ time }: Renderer) {
  return time * TURN_SPEED;
}

function getObserver() {
  observer ??= new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      const canvas = target as HTMLCanvasElement;

      if (!isIntersecting) {
        visibleCanvases.delete(canvas);
        return;
      }

      visibleCanvases.add(canvas);

      if (renderer?.hasFrame && !heldCanvases.has(canvas)) copyFrame(canvas);
    });

    updatePlayback();
  });

  return observer;
}
