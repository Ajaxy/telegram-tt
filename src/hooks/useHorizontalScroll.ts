import { useEffect } from '../lib/teact/teact';

const useHorizontalScroll = (container: HTMLElement | null, isDisabled?: boolean) => {
  useEffect(() => {
    if (!container || isDisabled) {
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
  }, [container, isDisabled]);
};

export default useHorizontalScroll;
