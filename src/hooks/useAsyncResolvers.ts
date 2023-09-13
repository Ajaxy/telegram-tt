import type { Scheduler } from '../util/schedulers';
import type { Signal } from '../util/signals';

import useDebouncedCallback from './useDebouncedCallback';
import useDerivedSignal from './useDerivedSignal';
import useThrottledCallback from './useThrottledCallback';

export function useThrottledResolver<T>(
  resolver: () => T,
  deps: any[],
  msOrSchedulerFn: number | Scheduler,
  noFirst = false,
) {
  return useThrottledCallback((setValue: (newValue: T) => void) => {
    setValue(resolver());
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, deps, msOrSchedulerFn, noFirst);
}

export function useThrottledSignal<T extends any>(
  getValue: Signal<T>,
  ms: number,
  noFirst = false,
): Signal<T> {
  const throttledResolver = useThrottledResolver(() => getValue(), [getValue], ms, noFirst);

  return useDerivedSignal(
    throttledResolver, [throttledResolver, getValue], true,
  );
}

export function useDebouncedResolver<T>(
  resolver: () => T,
  deps: any[],
  ms: number,
  noFirst = false,
  noLast = false,
) {
  return useDebouncedCallback((setValue: (newValue: T) => void) => {
    setValue(resolver());
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, deps, ms, noFirst, noLast);
}

export function useDebouncedSignal<T extends any>(
  getValue: Signal<T>,
  ms: number,
  noFirst = false,
  noLast = false,
): Signal<T> {
  const debouncedResolver = useDebouncedResolver(() => getValue(), [getValue], ms, noFirst, noLast);

  return useDerivedSignal(
    debouncedResolver, [debouncedResolver, getValue], true,
  );
}
