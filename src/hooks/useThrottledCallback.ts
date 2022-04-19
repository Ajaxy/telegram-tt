import { useCallback, useMemo } from '../lib/teact/teact';

import { throttle } from '../util/schedulers';

export default function useThrottledCallback<T extends AnyToVoidFunction>(
  fn: T,
  deps: any[],
  ms: number,
  noFirst?: boolean,
) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fnMemo = useCallback(fn, deps);

  return useMemo(() => {
    return throttle(fnMemo, ms, !noFirst);
  }, [fnMemo, ms, noFirst]);
}
