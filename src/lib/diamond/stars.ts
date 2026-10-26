import { clamp } from '../../util/math';

export type StarBurst = {
  // Seconds of the diamond clock
  startTime: number;
  seed: number;
};

export const STAR_BURST_DURATION = 2;

export const STAR_CORNER_COUNT = 6;

const BURST_STAR_COUNT = 144;

export function getStarCount(burstSize: number) {
  return Math.max(1, Math.round(BURST_STAR_COUNT * clamp(burstSize, 0, 1)));
}
