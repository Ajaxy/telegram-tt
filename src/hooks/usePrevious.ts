import { useRef } from '../lib/teact/teact';

function usePrevious<T extends any>(next: T): T | undefined;
function usePrevious<T extends any>(next: T, shouldSkipUndefined: true): Exclude<T, undefined> | undefined;
function usePrevious<T extends any>(next: T, shouldSkipUndefined?: boolean): Exclude<T, undefined> | undefined;
function usePrevious<T extends any>(next: T, shouldSkipUndefined?: boolean) {
  const ref = useRef<T>();
  const { current } = ref;
  if (!shouldSkipUndefined || next !== undefined) {
    ref.current = next;
  }

  return current;
}

export default usePrevious;
