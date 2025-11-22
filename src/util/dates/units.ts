/// In seconds
export const MINUTE = 60;
export const HOUR = 3600;
export const DAY = 86400;
export const WEEK = 7 * DAY;
export const MONTH = 30 * DAY;

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

export function getSeconds(hours: number, minutes: number, seconds: number) {
  return hours * HOUR + minutes * MINUTE + seconds;
}
