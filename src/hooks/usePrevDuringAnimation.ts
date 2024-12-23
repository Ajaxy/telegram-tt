import { useRef } from '../lib/teact/teact';

import useForceUpdate from './useForceUpdate';
import usePreviousDeprecated from './usePreviousDeprecated';
import useSyncEffect from './useSyncEffect';

export default function usePrevDuringAnimation<T>(current: T, duration?: number): T {
  const prev = usePreviousDeprecated(current, true);
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

  return (!timeoutRef.current || !duration || isCurrentPresent ? current : prev)!;
}
