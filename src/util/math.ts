export const clamp = (num: number, min: number, max: number) => (Math.min(max, Math.max(min, num)));
export const isBetween = (num: number, min: number, max: number) => (num >= min && num <= max);
export const round = (num: number, decimals: number = 0) => Math.round(num * 10 ** decimals) / 10 ** decimals;
export const lerp = (start: number, end: number, interpolationRatio: number) => {
  return (1 - interpolationRatio) * start + interpolationRatio * end;
};
