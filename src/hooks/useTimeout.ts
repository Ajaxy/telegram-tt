import { useEffect, useLayoutEffect, useRef } from '../lib/teact/teact';

function useTimeout(callback: () => void, delay?: number) {
  const savedCallback = useRef(callback);

  useLayoutEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (typeof delay !== 'number') {
      return undefined;
    }
    const id = setTimeout(() => savedCallback.current(), delay);
    return () => clearTimeout(id);
  }, [delay]);
}

export default useTimeout;
