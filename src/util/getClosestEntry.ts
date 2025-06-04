export function getClosestEntry(arr: number[], value: number): number {
  return arr.reduce((prev, curr) => {
    return Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev;
  });
}
