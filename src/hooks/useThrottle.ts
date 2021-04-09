import { useMemo } from '../lib/teact/teact';

import { throttle } from '../util/schedulers';

export default (ms: number) => {
  return useMemo(() => {
    return throttle((cb) => cb(), ms);
  }, [ms]);
};
