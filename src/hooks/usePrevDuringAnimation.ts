import { useRef } from '../lib/teact/teact';

import usePrevious from './usePrevious';
import useForceUpdate from './useForceUpdate';
import useSyncEffect from './useSyncEffect';

export default function usePrevDuringAnimation(current: any, duration?: number) {
  const prev = usePrevious(current, true);
  const timeoutRef = useRef<number>();
  const forceUpdate = useForceUpdate();
  // eslint-disable-next-line no-null/no-null
  const isCurrentPresent = current !== undefined && current !== null;
  // eslint-disable-next-line no-null/no-null
  const isPrevPresent = prev !== undefined && prev !== null;

  if (isCurrentPresent && timeoutRef.current) {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = undefined;
  }

  useSyncEffect(() => {
    // When `current` becomes empty
    if (duration && !isCurrentPresent && isPrevPresent && !timeoutRef.current) {
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = undefined;
        forceUpdate();
      }, duration);
    }
  }, [duration, forceUpdate, isCurrentPresent, isPrevPresent]);

  return !timeoutRef.current || !duration || isCurrentPresent ? current : prev;
}
