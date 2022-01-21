import { useMemo } from '../lib/teact/teact';

import { debounce } from '../util/schedulers';

export default function useDebounce(ms: number, noFirst?: boolean, noLast?: boolean) {
  return useMemo(() => {
    return debounce((cb) => cb(), ms, !noFirst, !noLast);
  }, [ms, noFirst, noLast]);
}
