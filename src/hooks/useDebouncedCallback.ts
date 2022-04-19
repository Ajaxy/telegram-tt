import { useCallback, useMemo } from '../lib/teact/teact';

import { debounce } from '../util/schedulers';

export default function useDebouncedCallback<T extends AnyToVoidFunction>(
  fn: T,
  deps: any[],
  ms: number,
  noFirst?: boolean,
  noLast?: boolean,
) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fnMemo = useCallback(fn, deps);

  return useMemo(() => {
    return debounce(fnMemo, ms, !noFirst, !noLast);
  }, [fnMemo, ms, noFirst, noLast]);
}
