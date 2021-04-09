export default function cycleRestrict(length: number, index: number) {
  return index - Math.floor(index / length) * length;
}
