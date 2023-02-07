import { useRef } from '../lib/teact/teact';

import useSyncEffect from './useSyncEffect';

// Allows to use state value as "silent" dependency in hooks (not causing updates).
// Useful for state values that update frequently (such as controlled input value).
export function useStateRef<T>(value: T) {
  const ref = useRef<T>(value);

  useSyncEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}
