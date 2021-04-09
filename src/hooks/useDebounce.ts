import { useMemo } from '../lib/teact/teact';

import { debounce } from '../util/schedulers';

export default function useDebounce(ms: number, shouldRunFirst?: boolean, shouldRunLast?: boolean) {
  return useMemo(() => {
    return debounce((cb) => cb(), ms, shouldRunFirst, shouldRunLast);
  }, [ms, shouldRunFirst, shouldRunLast]);
}
