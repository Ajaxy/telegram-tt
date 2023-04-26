import { useCallback } from '../lib/teact/teact';

import { useStateRef } from './useStateRef';

export function useLastCallback<T extends AnyFunction>(callback?: T) {
  const ref = useStateRef(callback);

  return useCallback((...args: Parameters<T>) => ref.current?.(...args), [ref]) as T;
}
