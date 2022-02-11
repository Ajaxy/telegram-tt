import { useEffect } from '../lib/teact/teact';
import usePrevious from './usePrevious';

const useEffectWithPrevDeps = <T extends any[]>(cb: (args: T | []) => void, dependencies: T, debugKey?: string) => {
  const prevDeps = usePrevious<T>(dependencies);
  return useEffect(() => {
    return cb(prevDeps || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies, debugKey);
};

export default useEffectWithPrevDeps;
