import type { CurveChannel, CurveLevels, CurvesState } from '../../../../../types/mediaEditor';

export const CURVE_CHANNELS: CurveChannel[] = ['all', 'red', 'green', 'blue'];
export const DEFAULT_CURVE_LEVELS: CurveLevels = [0, 25, 50, 75, 100];
export const CURVES_LUT_SIZE = 256;

const LUT_CHANNELS: CurveChannel[] = ['red', 'green', 'blue', 'all'];
const SEGMENTS = DEFAULT_CURVE_LEVELS.length - 1;

function isCurveDefault(levels?: CurveLevels) {
  return !levels || levels.every((level, i) => level === DEFAULT_CURVE_LEVELS[i]);
}

export function isCurvesDefault(curves: CurvesState) {
  return CURVE_CHANNELS.every((channel) => isCurveDefault(curves[channel]));
}

export function getCurveValue(levels: CurveLevels, x: number) {
  const position = Math.min(Math.max(x, 0), 1) * SEGMENTS;
  const segment = Math.min(Math.floor(position), SEGMENTS - 1);
  const t = position - segment;
  const getLevel = (index: number) => levels[index] / 100;
  const getPoint = (index: number) => {
    if (index < 0) return 2 * getLevel(0) - getLevel(1);
    if (index > SEGMENTS) return 2 * getLevel(SEGMENTS) - getLevel(SEGMENTS - 1);
    return getLevel(index);
  };
  const p0 = getPoint(segment - 1);
  const p1 = getPoint(segment);
  const p2 = getPoint(segment + 1);
  const p3 = getPoint(segment + 2);

  const value = 0.5 * (
    2 * p1
    + (p2 - p0) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
    + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t
  );

  return Math.min(Math.max(value, 0), 1);
}

export function buildCurvesLut(curves: CurvesState) {
  const lut = new Uint8Array(CURVES_LUT_SIZE * 4);

  LUT_CHANNELS.forEach((channel, channelIndex) => {
    const levels = curves[channel] ?? DEFAULT_CURVE_LEVELS;
    for (let i = 0; i < CURVES_LUT_SIZE; i++) {
      lut[i * 4 + channelIndex] = Math.round(getCurveValue(levels, i / (CURVES_LUT_SIZE - 1)) * 255);
    }
  });

  return lut;
}
