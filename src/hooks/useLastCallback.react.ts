import { useCallback } from 'react';

import { useStateRef } from './useStateRef.react';

export default function useLastCallback<T extends AnyFunction>(callback?: T) {
  const ref = useStateRef(callback);

  // No need for ref dependency
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  return useCallback((...args: Parameters<T>) => ref.current?.(...args), []) as T;
}
