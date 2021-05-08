import { useRef } from '../lib/teact/teact';

import usePrevious from './usePrevious';
import useForceUpdate from './useForceUpdate';
import useOnChange from './useOnChange';

export default function usePrevDuringAnimation(current: any, duration?: number) {
  const prev = usePrevious(current, true);
  const timeoutRef = useRef<number>();
  const forceUpdate = useForceUpdate();
  // eslint-disable-next-line no-null/no-null
  const isCurrentPresent = current !== undefined && current !== null;

  if (isCurrentPresent && timeoutRef.current) {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = undefined;
  }

  useOnChange(() => {
    // When `current` becomes empty
    if (duration && !isCurrentPresent && prev && !timeoutRef.current) {
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = undefined;
        forceUpdate();
      }, duration);
    }
  }, [current]);

  return !timeoutRef.current || !duration || isCurrentPresent ? current : prev;
}
