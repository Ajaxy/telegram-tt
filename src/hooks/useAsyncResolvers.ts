import useThrottledCallback from './useThrottledCallback';
import useDebouncedCallback from './useDebouncedCallback';

export function useThrottledResolver<T>(resolver: () => T, deps: any[], ms: number, noFirst = false) {
  return useThrottledCallback((setValue: (newValue: T) => void) => {
    setValue(resolver());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps, ms, noFirst);
}

export function useDebouncedResolver<T>(resolver: () => T, deps: any[], ms: number, noFirst = false, noLast = false) {
  return useDebouncedCallback((setValue: (newValue: T) => void) => {
    setValue(resolver());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps, ms, noFirst, noLast);
}
