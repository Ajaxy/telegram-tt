import type { DiamondDrawState, DiamondPalette, DiamondViewport } from './model';

import { timingFunctions } from '../../util/animation';
import { lerp } from '../../util/math';
import { getOpenModalCount } from '../../util/openModals';
import { getIsHeavyAnimating, onFullyIdle } from '../teact/teact';
import { createGpuCanvas, requestGpuRenderer } from './gpu';
import { getFrameTime, TURN_DURATION } from './model';
import { createFrameWatchdog, getIsDiamond3dDegraded } from './performance';

import { getIsInBackground } from '../../hooks/window/useBackgroundMode';

export type DiamondOptions = {
  palette?: DiamondPalette;
  // Seconds per turn while nobody holds the diamond
  turnDuration?: number;
  // A small diamond that only turns needs fewer frames than one in the hand
  restFrameInterval?: number;
};

// Angles are in radians, times in seconds of the diamond clock
type DrawDiamond = (
  state: DiamondDrawState, viewport: DiamondViewport, time: number, frameTime: number, yaw: number, pitch: number,
) => void;

type Animation = {
  startTime: number;
  duration: number;
  isRepeated?: boolean;
  onUpdate: (progress: number) => void;
  onEnd?: NoneToVoidFunction;
};

// Longer than a frame on 120 Hz screens and shorter than a frame on 100 Hz screens
const MIN_FRAME_INTERVAL = 9.5;

const IDLE_DELAY = 0.5;
const RELEASE_DURATION = 0.6;
const TAP_DURATION = 0.22;

const FULL_TURN = 360;
const OVERSHOOT_TENSION = 2;
const TAP_MAX_YAW = 10;
const TAP_MIN_ANGLE = 40;
const TAP_ANGLE_SPREAD = 30;
const TOUCH_SLOP = 8;
// Device pixels, so the diamond turns as fast as in the Android app on a screen of the same density
const DRAG_YAW_SPEED = 0.5;
const DRAG_PITCH_SPEED = 0.05;

export function setupDiamond(
  canvas: HTMLCanvasElement,
  onReady: NoneToVoidFunction,
  onError: NoneToVoidFunction,
  options: DiamondOptions = {},
) {
  if (getIsDiamond3dDegraded()) {
    onError();

    return undefined;
  }

  let isDestroyed = false;
  let destroyRenderer: NoneToVoidFunction | undefined;

  const unsubscribeFromDegradation = getIsDiamond3dDegraded.subscribe(() => {
    if (getIsDiamond3dDegraded()) onError();
  });

  // The device starts and compiles its pipelines in the GPU process, which the opening animation keeps busy
  onFullyIdle(() => {
    if (isDestroyed) return;

    destroyRenderer = createRenderer(canvas, onReady, onError, options);
  });

  return () => {
    isDestroyed = true;
    unsubscribeFromDegradation();
    destroyRenderer?.();
  };
}

// The diamond draws straight into its canvas on the device the other diamonds share
function createRenderer(
  canvas: HTMLCanvasElement,
  onReady: NoneToVoidFunction,
  onError: NoneToVoidFunction,
  options: DiamondOptions,
) {
  let isDestroyed = false;
  let stop: NoneToVoidFunction | undefined;
  let teardown: NoneToVoidFunction | undefined;

  void requestGpuRenderer().then((gpu) => {
    if (isDestroyed) return;

    const gpuCanvas = gpu && createGpuCanvas(gpu, canvas, options.palette ?? 'regular');
    if (!gpu || !gpuCanvas) {
      onError();
      return;
    }

    teardown = gpuCanvas.destroy;
    stop = startRendering(canvas, (state, viewport, time, frameTime, yaw, pitch) => {
      const encoder = gpu.device.createCommandEncoder();
      const pass = gpuCanvas.beginPass(encoder);
      gpu.scene.draw(pass, gpuCanvas.sceneTarget, state, viewport, time, frameTime, yaw, pitch);
      pass.end();
      gpu.device.queue.submit([encoder.finish()]);
    }, onReady, options);
  });

  return () => {
    isDestroyed = true;
    stop?.();
    teardown?.();
  };
}

function startRendering(
  canvas: HTMLCanvasElement,
  draw: DrawDiamond,
  onReady: NoneToVoidFunction,
  { turnDuration = TURN_DURATION, restFrameInterval = MIN_FRAME_INTERVAL }: DiamondOptions,
) {
  // The modals open at start are the diamond's own; anything on top of them covers it
  const baseModalCount = getOpenModalCount();
  const pixelRatio = window.devicePixelRatio || 1;
  const watchdog = createFrameWatchdog();
  const drawState: DiamondDrawState = {};
  const viewport = { x: 0, y: 0, size: canvas.width };

  let frameId: number | undefined;
  let lastFrameTime: number | undefined;
  let time = 0;
  let isReady = false;

  // Degrees
  let yaw = 0;
  let pitch = 0;
  let animation: Animation | undefined;
  let isIdleEnabled = false;
  let isPressed = false;
  let isDragging = false;
  // The first report of the observer comes right after it starts
  let isVisible = false;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;

  function render(now: number) {
    frameId = requestAnimationFrame(render);
    watchdog.track(now);

    // Android draws at most 60 times per second; skipping every other frame on 120 Hz halves the GPU work
    const isMoving = isPressed || (animation && !animation.isRepeated);
    const minInterval = isMoving ? MIN_FRAME_INTERVAL : restFrameInterval;
    if (lastFrameTime !== undefined && now - lastFrameTime < minInterval) return;

    const frameTime = getFrameTime(now, lastFrameTime);
    lastFrameTime = now;
    time += frameTime;

    if (!isIdleEnabled && time >= IDLE_DELAY) {
      isIdleEnabled = true;
      startIdle();
    }

    updateAnimation();
    draw(drawState, viewport, time, frameTime, convertToRadians(yaw), convertToRadians(pitch));

    if (!isReady) {
      isReady = true;
      onReady();
    }
  }

  function updateAnimation() {
    if (!animation) return;

    const current = animation;
    const progress = Math.max(0, time - current.startTime) / current.duration;

    if (current.isRepeated) {
      current.onUpdate(progress % 1);
      return;
    }

    current.onUpdate(Math.min(progress, 1));

    if (progress >= 1) {
      animation = undefined;
      current.onEnd?.();
    }
  }

  function startIdle() {
    if (!isIdleEnabled || isPressed || animation) return;

    const fromYaw = yaw;

    animation = {
      startTime: time,
      duration: turnDuration,
      isRepeated: true,
      onUpdate: (progress) => {
        yaw = fromYaw + FULL_TURN * progress;
      },
    };
  }

  function release() {
    const fromYaw = yaw;
    const fromPitch = pitch;

    animation = {
      startTime: time,
      duration: RELEASE_DURATION,
      onUpdate: (progress) => {
        const ratio = 1 - easeOvershoot(progress);
        yaw = fromYaw * ratio;
        pitch = fromPitch * ratio;
      },
      onEnd: startIdle,
    };
  }

  function tiltTowards(x: number, y: number) {
    if (Math.abs(yaw) > TAP_MAX_YAW) return;

    const halfSize = Math.max(1, canvas.clientWidth / 2);
    const fromYaw = yaw;
    const fromPitch = pitch;
    const toYaw = ((halfSize - x) * getTapAngle()) / halfSize;
    const toPitch = ((halfSize - y) * getTapAngle()) / halfSize;

    animation = {
      startTime: time,
      duration: TAP_DURATION,
      onUpdate: (progress) => {
        const ratio = timingFunctions.easeOutQuint(progress);
        yaw = lerp(fromYaw, toYaw, ratio);
        pitch = lerp(fromPitch, toPitch, ratio);
      },
      onEnd: release,
    };
  }

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return;

    isPressed = true;
    isDragging = false;
    animation = undefined;
    // Client coordinates, since the offsets follow the canvas when it is scaled, as the card diamond is in the hand
    startX = lastX = e.clientX;
    startY = lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isPressed) return;

    // On macOS, Ctrl+click opens a context menu that takes the button release, so `pointerup` never arrives
    if (!e.buttons) {
      handlePointerUp(e);
      return;
    }

    if (!isDragging) {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) <= TOUCH_SLOP) return;

      isDragging = true;
    }

    yaw += (e.clientX - lastX) * pixelRatio * DRAG_YAW_SPEED;
    pitch += (e.clientY - lastY) * pixelRatio * DRAG_PITCH_SPEED;
    lastX = e.clientX;
    lastY = e.clientY;
  }

  function handlePointerUp(e: PointerEvent) {
    if (!isPressed) return;

    isPressed = false;
    release();

    if (!isDragging && e.type === 'pointerup') {
      tiltTowards(e.offsetX, e.offsetY);
    }
  }

  // Like animated stickers: pauses in a background window, during heavy animations, under a dialog and out of sight
  function updatePlayback() {
    if (!isVisible || getIsInBackground() || getIsHeavyAnimating() || getOpenModalCount() > baseModalCount) {
      pause();
    } else {
      resume();
    }
  }

  function resume() {
    if (frameId !== undefined) return;

    lastFrameTime = undefined;
    watchdog.reset();
    frameId = requestAnimationFrame(render);
  }

  function pause() {
    if (frameId === undefined) return;

    cancelAnimationFrame(frameId);
    frameId = undefined;
  }

  const unsubscribeFromBackground = getIsInBackground.subscribe(updatePlayback);
  const unsubscribeFromHeavyAnimation = getIsHeavyAnimating.subscribe(updatePlayback);
  const unsubscribeFromModals = getOpenModalCount.subscribe(updatePlayback);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    isVisible = entry.isIntersecting;
    updatePlayback();
  });
  visibilityObserver.observe(canvas);

  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointercancel', handlePointerUp);

  updatePlayback();

  return () => {
    pause();
    unsubscribeFromBackground();
    unsubscribeFromHeavyAnimation();
    unsubscribeFromModals();
    visibilityObserver.disconnect();
    canvas.removeEventListener('pointerdown', handlePointerDown);
    canvas.removeEventListener('pointermove', handlePointerMove);
    canvas.removeEventListener('pointerup', handlePointerUp);
    canvas.removeEventListener('pointercancel', handlePointerUp);
  };
}

function getTapAngle() {
  return Math.random() * TAP_ANGLE_SPREAD + TAP_MIN_ANGLE;
}

function easeOvershoot(t: number) {
  const shifted = t - 1;

  return shifted * shifted * ((OVERSHOOT_TENSION + 1) * shifted + OVERSHOOT_TENSION) + 1;
}

function convertToRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}
