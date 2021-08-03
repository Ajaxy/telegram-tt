import { useMemo } from '../lib/teact/teact';

import { throttle } from '../util/schedulers';

export default (ms: number, noFirst = false) => {
  return useMemo(() => {
    return throttle((cb) => cb(), ms, !noFirst);
  }, [ms, noFirst]);
};
