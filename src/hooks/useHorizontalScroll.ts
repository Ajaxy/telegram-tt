import { useEffect } from '../lib/teact/teact';

const useHorizontalScroll = (
  containerRef: React.RefObject<HTMLDivElement>,
  isDisabled?: boolean,
  shouldPreventDefault = false,
) => {
  useEffect(() => {
    if (isDisabled) {
      return undefined;
    }

    const container = containerRef.current!;

    function handleScroll(e: WheelEvent) {
      // Ignore horizontal scroll and let it work natively (e.g. on touchpad)
      if (!e.deltaX) {
        container.scrollLeft += e.deltaY / 4;
        if (shouldPreventDefault) e.preventDefault();
      }
    }

    container.addEventListener('wheel', handleScroll, { passive: !shouldPreventDefault });

    return () => {
      container.removeEventListener('wheel', handleScroll);
    };
  }, [containerRef, isDisabled, shouldPreventDefault]);
};

export default useHorizontalScroll;
