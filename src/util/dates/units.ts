/// In seconds
export const MINUTE = 60;
export const HOUR = 3600;
export const DAY = 86400;

export function getMinutes(seconds: number, roundDown?: boolean) {
  const roundFunc = roundDown ? Math.floor : Math.ceil;
  return roundFunc(seconds / MINUTE);
}

export function getHours(seconds: number, roundDown?: boolean) {
  const roundFunc = roundDown ? Math.floor : Math.ceil;
  return roundFunc(seconds / HOUR);
}

export function getDays(seconds: number, roundDown?: boolean) {
  const roundFunc = roundDown ? Math.floor : Math.ceil;
  return roundFunc(seconds / DAY);
}
