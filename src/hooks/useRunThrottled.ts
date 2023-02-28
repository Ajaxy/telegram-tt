import useThrottledCallback from './useThrottledCallback';

export default function useRunThrottled(ms: number, noFirst?: boolean, deps: any = []) {
  return useThrottledCallback((cb: NoneToVoidFunction) => {
    cb();
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, deps, ms, noFirst);
}
