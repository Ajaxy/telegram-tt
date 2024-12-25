import { useRef } from '../lib/teact/teact';

/**
 * @deprecated
 */
function usePreviousDeprecated<T extends any>(next: T): T | undefined;
function usePreviousDeprecated<T extends any>(next: T, shouldSkipUndefined: true): Exclude<T, undefined> | undefined;
// eslint-disable-next-line max-len
function usePreviousDeprecated<T extends any>(next: T, shouldSkipUndefined?: boolean): Exclude<T, undefined> | undefined;
function usePreviousDeprecated<T extends any>(next: T, shouldSkipUndefined?: boolean) {
  const ref = useRef<T>();
  const { current } = ref;
  if (!shouldSkipUndefined || next !== undefined) {
    ref.current = next;
  }

  return current;
}

export default usePreviousDeprecated;
