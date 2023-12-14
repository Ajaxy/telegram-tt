export function differenceInMinutes(timestamp: number) {
  const currentTime = Date.now();
  const timeDifferenceInMilliseconds = currentTime - timestamp;
  return timeDifferenceInMilliseconds / (1000 * 60);
}
