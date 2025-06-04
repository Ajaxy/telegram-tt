import { useRef } from '../lib/teact/teact';

/**
 * @deprecated
 */
function usePreviousDeprecated<T>(next: T): T | undefined;
function usePreviousDeprecated<T>(next: T, shouldSkipUndefined: true): Exclude<T, undefined> | undefined;

function usePreviousDeprecated<T>(next: T, shouldSkipUndefined?: boolean): Exclude<T, undefined> | undefined;
function usePreviousDeprecated<T>(next: T, shouldSkipUndefined?: boolean) {
  const ref = useRef<T>();
  const { current } = ref;
  if (!shouldSkipUndefined || next !== undefined) {
    ref.current = next;
  }

  return current;
}

export default usePreviousDeprecated;
