import type { DiamondDrawState, DiamondScene } from './scene';

import { timingFunctions } from '../../util/animation';
import { lerp } from '../../util/math';
import { getOpenModalCount } from '../../util/openModals';
import { getIsHeavyAnimating, onFullyIdle } from '../teact/teact';
import { createFrameWatchdog, getIsDiamond3dDegraded } from './performance';
import { createDiamondScene, getFrameTime, TURN_DURATION } from './scene';

import { getIsInBackground } from '../../hooks/window/useBackgroundMode';

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

  // Creating a WebGL context blocks until the GPU process answers, which the opening animation keeps busy
  onFullyIdle(() => {
    if (isDestroyed) return;

    destroyRenderer = createRenderer(canvas, onReady, onError);
  });

  return () => {
    isDestroyed = true;
    unsubscribeFromDegradation();
    destroyRenderer?.();
  };
}

function createRenderer(
  canvas: HTMLCanvasElement,
  onReady: NoneToVoidFunction,
  onError: NoneToVoidFunction,
) {
  // Without a usable GPU the browser renders WebGL on the CPU, far too slow for these shaders
  const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });

  if (!gl) {
    onError();

    return undefined;
  }

  let isDestroyed = false;
  let stop: NoneToVoidFunction | undefined;

  createDiamondScene(gl, 'regular')
    .then((scene) => {
      if (isDestroyed) return;

      stop = startRendering(canvas, scene, onReady);
    })
    .catch(() => {
      if (!isDestroyed) onError();
    });

  canvas.addEventListener('webglcontextlost', onError);

  return () => {
    isDestroyed = true;
    stop?.();
    canvas.removeEventListener('webglcontextlost', onError);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}

function startRendering(canvas: HTMLCanvasElement, scene: DiamondScene, onReady: NoneToVoidFunction) {
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
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;

  function render(now: number) {
    frameId = requestAnimationFrame(render);
    watchdog.track(now);

    // Android draws at most 60 times per second; skipping every other frame on 120 Hz halves the GPU work
    if (lastFrameTime !== undefined && now - lastFrameTime < MIN_FRAME_INTERVAL) return;

    const frameTime = getFrameTime(now, lastFrameTime);
    lastFrameTime = now;
    time += frameTime;

    if (!isIdleEnabled && time >= IDLE_DELAY) {
      isIdleEnabled = true;
      startIdle();
    }

    updateAnimation();
    scene.draw(drawState, viewport, time, frameTime, convertToRadians(yaw), convertToRadians(pitch));

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
      duration: TURN_DURATION,
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
    startX = lastX = e.offsetX;
    startY = lastY = e.offsetY;
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
      if (Math.hypot(e.offsetX - startX, e.offsetY - startY) <= TOUCH_SLOP) return;

      isDragging = true;
    }

    yaw += (e.offsetX - lastX) * pixelRatio * DRAG_YAW_SPEED;
    pitch += (e.offsetY - lastY) * pixelRatio * DRAG_PITCH_SPEED;
    lastX = e.offsetX;
    lastY = e.offsetY;
  }

  function handlePointerUp(e: PointerEvent) {
    if (!isPressed) return;

    isPressed = false;
    release();

    if (!isDragging && e.type === 'pointerup') {
      tiltTowards(e.offsetX, e.offsetY);
    }
  }

  // Like animated stickers: pauses in a background window, during heavy animations and under a dialog
  function updatePlayback() {
    if (getIsInBackground() || getIsHeavyAnimating() || getOpenModalCount() > baseModalCount) {
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
