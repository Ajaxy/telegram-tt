import { useCallback, useRef } from '../lib/teact/teact';

export default function useCacheBusterRef() {
  const cacheBusterRef = useRef(0);

  const updateCacheBusterRef = useCallback(() => {
    cacheBusterRef.current += 1;
  }, []);

  return [cacheBusterRef, updateCacheBusterRef] as const;
}
