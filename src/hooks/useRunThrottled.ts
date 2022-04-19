import useThrottledCallback from './useThrottledCallback';

export default function useRunThrottled(ms: number, noFirst?: boolean) {
  return useThrottledCallback((cb: NoneToVoidFunction) => {
    cb();
  }, [], ms, noFirst);
}
