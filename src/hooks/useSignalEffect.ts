import { useRef, useUnmountCleanup } from '../lib/teact/teact';

import { requestMeasure } from '../lib/fasterdom/fasterdom';
import { cleanupEffect, isSignal } from '../util/signals';

export function useSignalEffect(effect: NoneToVoidFunction, dependencies: readonly any[]) {
  // This runs before all effects
  const prevDepsRef = useRef<readonly unknown[]>();
  const subscribedEffectRef = useRef<NoneToVoidFunction>();

  const prevDeps = prevDepsRef.current;
  const hasChanged = !prevDeps
    || dependencies.length !== prevDeps.length
    || dependencies.some((dep, i) => dep !== prevDeps[i]);

  if (hasChanged) {
    if (subscribedEffectRef.current) {
      cleanupEffect(subscribedEffectRef.current);
    }

    subscribedEffectRef.current = effect;
    prevDepsRef.current = dependencies;

    dependencies.forEach((dependency) => {
      if (isSignal(dependency)) {
        dependency.subscribe(effect);
      }
    });

    const currentEffect = effect;
    requestMeasure(() => {
      if (subscribedEffectRef.current !== currentEffect) return;
      currentEffect();
    });
  }

  useUnmountCleanup(() => {
    if (subscribedEffectRef.current) {
      cleanupEffect(subscribedEffectRef.current);
    }
  });
}
