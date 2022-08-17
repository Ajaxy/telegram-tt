import { useEffect } from '../lib/teact/teact';

const useHorizontalScroll = (container: HTMLElement | null, isDisabled?: boolean, shouldPreventDefault = false) => {
  useEffect(() => {
    if (!container || isDisabled) {
      return undefined;
    }

    function handleScroll(e: WheelEvent) {
      // Ignore horizontal scroll and let it work natively (e.g. on touchpad)
      if (!e.deltaX) {
        container!.scrollLeft += e.deltaY / 4;
        if (shouldPreventDefault) e.preventDefault();
      }
    }

    container.addEventListener('wheel', handleScroll, { passive: !shouldPreventDefault });

    return () => {
      container.removeEventListener('wheel', handleScroll);
    };
  }, [container, isDisabled, shouldPreventDefault]);
};

export default useHorizontalScroll;
