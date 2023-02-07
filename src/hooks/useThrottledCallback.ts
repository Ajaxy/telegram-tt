import { useCallback, useMemo } from '../lib/teact/teact';

import type { fastRaf } from '../util/schedulers';
import { throttle, throttleWithRaf } from '../util/schedulers';

export default function useThrottledCallback<T extends AnyToVoidFunction>(
  fn: T,
  deps: any[],
  msOrRaf: number | typeof fastRaf,
  noFirst = false,
) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fnMemo = useCallback(fn, deps);

  return useMemo(() => {
    if (typeof msOrRaf === 'number') {
      return throttle(fnMemo, msOrRaf, !noFirst);
    } else {
      return throttleWithRaf(fnMemo);
    }
  }, [fnMemo, msOrRaf, noFirst]);
}
