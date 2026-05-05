import { useRef } from '../lib/teact/teact';

import useForceUpdate from './useForceUpdate';
import usePreviousDeprecated from './usePreviousDeprecated';
import useSyncEffect from './useSyncEffect';

const SWAP_CLOSE_DURATION = 150;

export default function useShowTransitionSwap(isOpen: boolean, contentKey?: string): boolean {
  const prevIsOpen = usePreviousDeprecated(isOpen);
  const prevContentKey = usePreviousDeprecated(contentKey);
  const isSwappingRef = useRef(false);
  const forceUpdate = useForceUpdate();

  if (isOpen && prevIsOpen
    && contentKey !== undefined && prevContentKey !== undefined
    && prevContentKey !== contentKey && !isSwappingRef.current) {
    isSwappingRef.current = true;
  }

  useSyncEffect(() => {
    if (!isSwappingRef.current) return undefined;
    const timer = window.setTimeout(() => {
      isSwappingRef.current = false;
      forceUpdate();
    }, SWAP_CLOSE_DURATION);
    return () => clearTimeout(timer);
  }, [contentKey]);

  return isOpen && !isSwappingRef.current;
}
