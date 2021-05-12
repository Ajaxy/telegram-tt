import { useEffect, useState } from '../lib/teact/teact';

import { IDimensions } from '../modules/helpers';

import { throttle } from '../util/schedulers';
import windowSize from '../util/windowSize';

const THROTTLE = 250;

export default () => {
  const [size, setSize] = useState<IDimensions>(windowSize.get());

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
