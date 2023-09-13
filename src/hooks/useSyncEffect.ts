import { useRef } from '../lib/teact/teact';

import useEffectOnce from './useEffectOnce';
import usePrevious from './usePrevious';

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
