import { useRef } from 'react';

import useEffectOnce from './useEffectOnce.react';
import usePrevious from './usePrevious.react';

export default function useSyncEffect<const T extends readonly any[]>(
  effect: (args: T | readonly []) => NoneToVoidFunction | void,
  dependencies: T,
) {
  const prevDeps = usePrevious<T>(dependencies);
  const cleanupRef = useRef<NoneToVoidFunction>();

  if (!prevDeps || dependencies.some((d, i) => d !== prevDeps[i])) {
    cleanupRef.current?.();
    cleanupRef.current = effect(prevDeps || []) ?? undefined;
  }

  useEffectOnce(() => {
    return () => {
      cleanupRef.current?.();
    };
  });
}
