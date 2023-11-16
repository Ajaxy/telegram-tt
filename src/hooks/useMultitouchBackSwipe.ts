import { useEffect, useState } from 'react';
import { ipcRenderer } from 'electron';

const useMultitouchBackSwipe = (callback: () => void, threshold = 100) => {
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    const handleScrollTouchBegin = () => {
      setScrollPosition(0); // Сброс позиции прокрутки при начале жеста
    };

    const handleScrollTouchEnd = () => {
      if (scrollPosition > threshold) {
        callback(); // Вызов callback, если прокрутка превысила порог
      }
    };

    const handleWheel = (e: { deltaX: number }) => {
      setScrollPosition((prev) => prev + e.deltaX); // Обновление позиции прокрутки
    };

    document.addEventListener('wheel', handleWheel);
    ipcRenderer.on('scroll-touch-begin', handleScrollTouchBegin);
    ipcRenderer.on('scroll-touch-end', handleScrollTouchEnd);

    return () => {
      document.removeEventListener('wheel', handleWheel);
      ipcRenderer.removeListener('scroll-touch-begin', handleScrollTouchBegin);
      ipcRenderer.removeListener('scroll-touch-end', handleScrollTouchEnd);
    };
  }, [callback, scrollPosition, threshold]);

  return scrollPosition;
};

export default useMultitouchBackSwipe;
