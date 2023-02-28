import useDebouncedCallback from './useDebouncedCallback';

export default function useRunDebounced(ms: number, noFirst?: boolean, noLast?: boolean, deps: any = []) {
  return useDebouncedCallback((cb: NoneToVoidFunction) => {
    cb();
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, deps, ms, noFirst, noLast);
}
