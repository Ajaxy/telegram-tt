import { RefObject } from 'react';
import { useEffect } from '../lib/teact/teact';

export default (containerRef: RefObject<HTMLElement>, isDisabled?: boolean) => {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    function handleScroll(e: WheelEvent) {
      // Ignore horizontal scroll and let it work natively (e.g. on touchpad)
      if (!e.deltaX) {
        container!.scrollLeft += e.deltaY / 4;
      }
    }

    container.addEventListener('wheel', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('wheel', handleScroll);
    };
  }, [containerRef, isDisabled]);
};
