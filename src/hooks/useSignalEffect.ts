import { useRef } from '../lib/teact/teact';
import { cleanupEffect, isSignal } from '../util/signals';
import useEffectOnce from './useEffectOnce';

export function useSignalEffect(effect: NoneToVoidFunction, dependencies: readonly any[]) {
  // The is extracted from `useEffectOnce` to run before all effects
  const isFirstRun = useRef(true);
  if (isFirstRun.current) {
    isFirstRun.current = false;

    dependencies?.forEach((dependency) => {
      if (isSignal(dependency)) {
        dependency.subscribe(effect);
      }
    });
  }

  useEffectOnce(() => {
    return () => {
      cleanupEffect(effect);
    };
  });
}
