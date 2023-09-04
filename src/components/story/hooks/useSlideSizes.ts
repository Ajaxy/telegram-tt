import useWindowSize from '../../../hooks/useWindowSize';
import { useMemo } from '../../../lib/teact/teact';
import { calculateSlideSizes } from '../helpers/dimensions';

export const useSlideSizes = () => {
  const { width: windowWidth, height: windowHeight } = useWindowSize();
  return useMemo(() => calculateSlideSizes(windowWidth, windowHeight), [windowWidth, windowHeight]);
};
