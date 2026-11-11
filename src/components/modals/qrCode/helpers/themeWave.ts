// Adapted from https://github.com/DrKLO/Telegram/blob/master/TMessagesProj/src/main/java/org/telegram/ui/QrShare/QrShareView.java

import type { LayerRect, Point } from './floatingLayer';

import { clamp } from '../../../../util/math';
import { getBounceScale } from './bounce';

export type WaveFrame = {
  origin: Point;
  maxRadius: number;
  elapsed: number;
};

export type WavePush = {
  x: number;
  y: number;
  rotation: number;
  scale: number;
};

export const WAVE_DURATION = 600;
export const WAVE_PUSH_DURATION = WAVE_DURATION + 700;

const WAVE_EASING_POWER = 2.4;
const WAVE_OVERSCAN = 60;

const RING_MIN_RADIUS = 4;
const RING_ALPHA = 0.38;
const RING_HOLD = 1.6;
const RING_BAND_FROM = 90;
const RING_BAND_TILL = 56;
const RING_STOPS: [number, number][] = [[0.45, 0.2], [0.82, 0.6]];

const SPRING_STIFFNESS = 220;
const SPRING_DAMPING = 0.62;
const SPRING_FREQUENCY = Math.sqrt(SPRING_STIFFNESS);
const SPRING_DAMPED_FREQUENCY = SPRING_FREQUENCY * Math.sqrt(1 - SPRING_DAMPING ** 2);
const PUSH_SPEED = 360;
const PUSH_ROTATION_SPEED = 180;
const PUSH_SCALE_SPEED = 1.8;
const PUSH_MASS_SHARE = 0.8;

const CARD_KEYFRAME_COUNT = 16;
const CARD_BOUNCE_DURATION = 320;
const CARD_BOUNCE_PEAK = 1.03;
const CARD_BOUNCE_DIP = 0.995;
const CARD_DIP_DURATION = 360;
const CARD_DIP_DEPTH = 0.03;
const CARD_DIP_DECAY = 0.3;

export const CARD_BOUNCE_ANIMATION = buildCardAnimation(getCardBounceScale, CARD_BOUNCE_DURATION);
export const CARD_DIP_ANIMATION = buildCardAnimation(getCardDipScale, CARD_DIP_DURATION);

export function getWaveMaxRadius(area: LayerRect, origin: Point) {
  return Math.hypot(
    Math.max(origin.x - area.left, area.left + area.width - origin.x),
    Math.max(origin.y - area.top, area.top + area.height - origin.y),
  ) + WAVE_OVERSCAN;
}

export function getWaveRadius(elapsed: number, maxRadius: number) {
  return maxRadius * easeWave(elapsed);
}

export function buildWaveRing(origin: Point, radius: number, elapsed: number, color: string) {
  if (radius <= RING_MIN_RADIUS) return undefined;

  const alpha = clamp((1 - elapsed / WAVE_DURATION) * RING_HOLD, 0, 1) * RING_ALPHA;
  if (alpha <= 0) return undefined;

  const band = RING_BAND_FROM + (RING_BAND_TILL - RING_BAND_FROM) * easeWave(elapsed);
  const start = Math.max(0, radius - band);
  const stops: [number, number][] = [
    [start, 0],
    ...RING_STOPS.map(([offset, share]): [number, number] => [start + offset * (radius - start), share]),
    [radius - 0.004 * (radius + 8), 1],
    [radius + 3, 0.4],
    [radius + 8, 0],
  ];

  const gradient = stops.map(([offset, share]) => (
    `color-mix(in srgb, ${color} ${(share * alpha * 100).toFixed(1)}%, transparent) ${offset.toFixed(1)}px`
  ));

  return `radial-gradient(circle at ${origin.x.toFixed(1)}px ${origin.y.toFixed(1)}px, ${gradient.join(', ')})`;
}

// Items get a spring impulse away from the origin when the wave front passes them
export function getWavePush(item: Point & { size: number }, wave: WaveFrame, massSize: number) {
  const dx = item.x - wave.origin.x;
  const dy = item.y - wave.origin.y;
  const distance = Math.hypot(dx, dy);
  const time = (wave.elapsed - getWaveArrival(distance, wave.maxRadius)) / 1000;
  if (time <= 0 || !distance) return undefined;

  const factor = (Math.exp(-SPRING_DAMPING * SPRING_FREQUENCY * time) * Math.sin(SPRING_DAMPED_FREQUENCY * time))
    / SPRING_DAMPED_FREQUENCY;
  const mass = 1 + Math.max(0, item.size / massSize - 1) * PUSH_MASS_SHARE;
  const speed = (PUSH_SPEED / mass) * factor;

  return {
    x: (dx / distance) * speed,
    y: (dy / distance) * speed,
    rotation: Math.sign(dx) * (PUSH_ROTATION_SPEED / mass) * factor,
    scale: 1 + PUSH_SCALE_SPEED * factor,
  } satisfies WavePush;
}

function getWaveArrival(distance: number, maxRadius: number) {
  return WAVE_DURATION * (1 - (1 - Math.min(distance / maxRadius, 1)) ** (1 / WAVE_EASING_POWER));
}

function easeWave(elapsed: number) {
  return 1 - (1 - clamp(elapsed / WAVE_DURATION, 0, 1)) ** WAVE_EASING_POWER;
}

function getCardBounceScale(progress: number) {
  return getBounceScale(progress, CARD_BOUNCE_PEAK - 1, 1 - CARD_BOUNCE_DIP);
}

function getCardDipScale(progress: number) {
  return 1 - CARD_DIP_DEPTH * Math.sin(Math.PI * progress) * (1 - CARD_DIP_DECAY * progress);
}

function buildCardAnimation(getScale: (progress: number) => number, duration: number) {
  const keyframes: Keyframe[] = [];
  for (let i = 0; i <= CARD_KEYFRAME_COUNT; i++) {
    keyframes.push({ transform: `scale(${getScale(i / CARD_KEYFRAME_COUNT).toFixed(4)})` });
  }

  return { keyframes, duration };
}
