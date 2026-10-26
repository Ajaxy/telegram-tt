import { clamp } from '../../../../util/math';

// `settle` overshoots by about 6% and `coast` by about 9%
const EASE_EXPONENT = 2.2;
const SETTLE_DECAY = 5.6;
const SETTLE_SWING = 6.2;
const COAST_DECAY = 4.2;
const COAST_SWING = 5.6;
const PULSE_DECAY = 0.3;
const LINEAR_EASING_STEPS = 28;
// An older browser throws on an unknown easing in `animate()`, so it gets a plain curve instead
const IS_LINEAR_EASING_SUPPORTED = Boolean(window.CSS?.supports('animation-timing-function', 'linear(0, 1)'));
export const FRAME_DURATION = 1000 / 60;

export const EASE_EASING = buildLinearEasing(ease);
export const SETTLE_EASING = buildLinearEasing(settle);

export function ease(t: number) {
  return 1 - (1 - clamp(t, 0, 1)) ** EASE_EXPONENT;
}

export function settle(t: number) {
  return getSpringProgress(t, SETTLE_DECAY, SETTLE_SWING);
}

export function coast(t: number) {
  return getSpringProgress(t, COAST_DECAY, COAST_SWING);
}

export function pulse(t: number) {
  return Math.sin(Math.PI * t) * (1 - PULSE_DECAY * t);
}

// For curves too sharp for the steps of `linear()` easing
export function sampleFrames(duration: number, getFrame: (time: number, progress: number) => Keyframe): Keyframe[] {
  const count = Math.ceil(duration / FRAME_DURATION);

  return Array.from({ length: count + 1 }, (_, i) => getFrame((i / count) * duration, i / count));
}

function buildLinearEasing(curve: (t: number) => number) {
  if (!IS_LINEAR_EASING_SUPPORTED) return 'ease-out';

  const points = Array.from({ length: LINEAR_EASING_STEPS + 1 }, (_, i) => curve(i / LINEAR_EASING_STEPS).toFixed(4));

  return `linear(${points.join(', ')})`;
}

function getSpringProgress(t: number, decay: number, swing: number) {
  const k = clamp(t, 0, 1);
  const u = k * k * (3 - 2 * k);

  return 1 - Math.exp(-decay * u) * (Math.cos(swing * u) + (decay / swing) * Math.sin(swing * u));
}
