import { useEffect, useLayoutEffect, useRef } from 'react';

function useInterval(callback: NoneToVoidFunction, delay?: number, noFirst = false) {
  const savedCallback = useRef(callback);

  useLayoutEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === undefined) {
      return undefined;
    }

    const id = setInterval(() => savedCallback.current(), delay);
    if (!noFirst) savedCallback.current();

    return () => clearInterval(id);
  }, [delay, noFirst]);
}

export default useInterval;
