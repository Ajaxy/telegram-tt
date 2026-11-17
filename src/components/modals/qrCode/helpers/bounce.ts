import { getSmoothStep, lerp } from '../../../../util/math';

export const BOUNCE_MS = 320;

const RISE_END = 0.25;
const DIP_END = 0.6;

export function getBounceScale(progress: number, up: number, down: number) {
  if (progress <= 0 || progress >= 1) return 1;
  if (progress < RISE_END) return 1 + up * Math.sin((Math.PI / 2) * (progress / RISE_END));
  if (progress < DIP_END) {
    return lerp(1 + up, 1 - down, getSmoothStep((progress - RISE_END) / (DIP_END - RISE_END)));
  }
  return lerp(1 - down, 1, getSmoothStep((progress - DIP_END) / (1 - DIP_END)));
}
