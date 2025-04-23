export function deepFreeze<T extends object | undefined>(o: T) {
  if (!o) return o;
  Object.values(o).forEach((v) => Object.isFrozen(v) || deepFreeze(v));
  return Object.freeze(o);
}
