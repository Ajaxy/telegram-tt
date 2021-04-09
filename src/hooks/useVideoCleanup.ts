import { RefObject } from 'react';
import { useEffect } from '../lib/teact/teact';
import { fastRaf } from '../util/schedulers';

// Fix for memory leak when unmounting video element
export default function useVideoCleanup(videoRef: RefObject<HTMLVideoElement>, dependencies: any[]) {
  useEffect(() => {
    const videoEl = videoRef.current;

    return () => {
      if (videoEl) {
        fastRaf(() => {
          videoEl.pause();
          videoEl.src = '';
          videoEl.load();
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}
