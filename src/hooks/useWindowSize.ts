import { useEffect, useState } from '../lib/teact/teact';

import { throttle } from '../util/schedulers';
import windowSize from '../util/windowSize';
import { ApiDimensions } from '../api/types';

const THROTTLE = 250;

const useWindowSize = () => {
  const [size, setSize] = useState<ApiDimensions>(windowSize.get());

  useEffect(() => {
    const handleResize = throttle(() => {
      setSize(windowSize.get());
    }, THROTTLE, false);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return size;
};

export default useWindowSize;
