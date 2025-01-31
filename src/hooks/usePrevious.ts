import { useRef } from '../lib/teact/teact';

// This is not render-dependent and will never allow previous to match current
export default function usePrevious<T extends any>(current: T) {
  const prevRef = useRef<T>();
  const lastRef = useRef<T>();

  if (lastRef.current !== current) {
    prevRef.current = lastRef.current;
  }

  lastRef.current = current;

  return prevRef.current;
}
