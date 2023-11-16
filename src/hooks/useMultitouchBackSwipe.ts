import { useEffect, useState } from 'react';

const useMultitouchBackSwipe = (onSwipeBack: () => void, threshold = 100) => {
  const [lastScrollLeft, setLastScrollLeft] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  useEffect(() => {
    const handleScroll = (event: { target: any }) => {
      const target = event.target;
      const currentScrollLeft = target.scrollLeft;

      if (currentScrollLeft > lastScrollLeft && currentScrollLeft > threshold) {
        if (!isSwiping) {
          setIsSwiping(true);
          onSwipeBack();
        }
      } else {
        setIsSwiping(false);
      }

      setLastScrollLeft(currentScrollLeft);
    };

    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onSwipeBack, threshold, lastScrollLeft, isSwiping]);

  return isSwiping;
};

export default useMultitouchBackSwipe;
