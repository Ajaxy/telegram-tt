import { useMemo } from '../lib/teact/teact';

import { throttle } from '../util/schedulers';

const useThrottle = (ms: number, noFirst = false) => {
  return useMemo(() => {
    return throttle((cb) => cb(), ms, !noFirst);
  }, [ms, noFirst]);
};

export default useThrottle;
