import { useEffect, useMemo, useState } from '../lib/teact/teact';
import type { ApiDimensions } from '../api/types';

import { throttle } from '../util/schedulers';
import windowSize from '../util/windowSize';
import useDebouncedCallback from './useDebouncedCallback';

const THROTTLE = 250;

const useWindowSize = () => {
  const [size, setSize] = useState<ApiDimensions>(windowSize.get());
  const [isResizing, setIsResizing] = useState(false);
  const setIsResizingDebounced = useDebouncedCallback(setIsResizing, [], THROTTLE, true);

  const result = useMemo(() => ({ ...size, isResizing }), [isResizing, size]);

  useEffect(() => {
    const throttledSetIsResizing = throttle(() => {
      setIsResizing(true);
    }, THROTTLE, true);

    const throttledSetSize = throttle(() => {
      setSize(windowSize.get());
      setIsResizingDebounced(false);
    }, THROTTLE, false);

    const handleResize = () => {
      throttledSetIsResizing();
      throttledSetSize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [setIsResizingDebounced]);

  return result;
};

export default useWindowSize;
