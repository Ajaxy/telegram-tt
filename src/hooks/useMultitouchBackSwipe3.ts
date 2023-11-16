import { useEffect } from 'react';

const useMultitouchBackSwipe3 = (onSwipeBack: () => void) => {
  useEffect(() => {
    const handleScroll = (e: WheelEvent) => {
      if (e.deltaX) {
        onSwipeBack();
      }
    };

    window.addEventListener('wheel', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleScroll);
    };
  }, [onSwipeBack]);
};

export default useMultitouchBackSwipe3;
