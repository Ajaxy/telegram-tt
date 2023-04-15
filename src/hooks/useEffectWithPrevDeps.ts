import { useEffect, useRef } from '../lib/teact/teact';

const useEffectWithPrevDeps = <const T extends readonly any[]>(
  cb: (args: T | readonly []) => void, dependencies: T, debugKey?: string,
) => {
  const prevDepsRef = useRef<T>();

  return useEffect(() => {
    const prevDeps = prevDepsRef.current;
    prevDepsRef.current = dependencies;

    return cb(prevDeps || []);
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, dependencies, debugKey);
};

export default useEffectWithPrevDeps;
