import usePrevious from './usePrevious';

const useOnChange = <T extends any[]>(cb: (args: T | []) => void, dependencies: T) => {
  const prevDeps = usePrevious<T>(dependencies);
  if (!prevDeps || dependencies.some((d, i) => d !== prevDeps[i])) {
    cb(prevDeps || []);
  }
};

export default useOnChange;
