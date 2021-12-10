import { areSortedArraysEqual } from './iteratees';

const cache = new WeakMap<AnyFunction, {
  lastArgs: any[];
  lastResult: any;
}>();

export default function memoized<T extends AnyFunction>(fn: T) {
  return (...args: Parameters<T>): ReturnType<T> => {
    const cached = cache.get(fn);
    if (cached && areSortedArraysEqual(cached.lastArgs, args)) {
      return cached.lastResult;
    }

    const result = fn(...args);
    cache.set(fn, { lastArgs: args, lastResult: result });
    return result;
  };
}
