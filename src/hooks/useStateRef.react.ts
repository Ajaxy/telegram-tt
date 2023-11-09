import { useRef } from 'react';

// Allows to use state value as "silent" dependency in hooks (not causing updates).
// Also useful for state values that update frequently (such as controlled input value).
export function useStateRef<T>(value: T) {
  const ref = useRef<T>(value);
  ref.current = value;
  return ref;
}
