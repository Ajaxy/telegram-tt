import useDebouncedCallback from './useDebouncedCallback';

export default function useRunDebounced(ms: number, noFirst?: boolean, noLast?: boolean) {
  return useDebouncedCallback((cb: NoneToVoidFunction) => {
    cb();
  }, [], ms, noFirst, noLast);
}
