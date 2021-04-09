import { useLayoutEffect } from '../lib/teact/teact';
import usePrevious from './usePrevious';

export default <T extends any[], PT = T>(cb: (args: PT) => void, dependencies: T) => {
  const prevDeps = usePrevious<T>(dependencies);
  return useLayoutEffect(() => {
    // @ts-ignore (workaround for "could be instantiated with a different subtype" issue)
    cb(prevDeps || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
};
