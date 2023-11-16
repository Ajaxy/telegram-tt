import { useEffect, useState } from 'react';
import { ipcRenderer } from 'electron';

const useMultitouchBackSwipe = (onSwipeBack: () => void) => {
  const [scrollStart, setScrollStart] = useState(0);
  const [scrollEnd, setScrollEnd] = useState(0);

  useEffect(() => {
    const handleGestureScrollBegin = (event: any) => {
      setScrollStart(event.scrollLeft); // Запомнить начальное положение прокрутки
    };

    const handleGestureScrollEnd = (event: any) => {
      setScrollEnd(event.scrollLeft); // Запомнить конечное положение прокрутки

      // Проверить, был ли свайп слева направо
      if (scrollEnd > scrollStart) {
        onSwipeBack();
      }
    };

    ipcRenderer.on('gesture-scroll-begin', handleGestureScrollBegin);
    ipcRenderer.on('gesture-scroll-end', handleGestureScrollEnd);

    return () => {
      ipcRenderer.removeListener('gesture-scroll-begin', handleGestureScrollBegin);
      ipcRenderer.removeListener('gesture-scroll-end', handleGestureScrollEnd);
    };
  }, [scrollStart, scrollEnd, onSwipeBack]);
};

export default useMultitouchBackSwipe;
