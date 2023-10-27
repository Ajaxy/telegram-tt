import { useEffect } from '../lib/teact/teact';

import useLastCallback from './useLastCallback';

function useTimeout(callback: () => void, delay?: number, dependencies: readonly any[] = []) {
  const savedCallback = useLastCallback(callback);

  useEffect(() => {
    if (typeof delay !== 'number') {
      return undefined;
    }

    const id = setTimeout(() => savedCallback(), delay);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [delay, savedCallback, ...dependencies]);
}

export default useTimeout;
