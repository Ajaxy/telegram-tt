import usePrevious from './usePrevious';

const useOnChange = <T extends any[], PT = T>(cb: (args: PT) => void, dependencies: T) => {
  const prevDeps = usePrevious<T>(dependencies);
  if (!prevDeps || dependencies.some((d, i) => d !== prevDeps[i])) {
    // @ts-ignore (workaround for "could be instantiated with a different subtype" issue)
    cb(prevDeps || []);
  }
};

export default useOnChange;
