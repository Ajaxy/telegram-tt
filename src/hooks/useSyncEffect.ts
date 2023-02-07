import usePrevious from './usePrevious';

const useSyncEffect = <T extends readonly any[]>(cb: (args: T | readonly []) => void, dependencies: T) => {
  const prevDeps = usePrevious<T>(dependencies);
  if (!prevDeps || dependencies.some((d, i) => d !== prevDeps[i])) {
    cb(prevDeps || []);
  }
};

export default useSyncEffect;
