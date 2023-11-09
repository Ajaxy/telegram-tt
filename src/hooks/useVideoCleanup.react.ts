import type { RefObject } from 'react';
import { useEffect } from 'react';

import { requestNextMutation } from '../lib/fasterdom/fasterdom';

// Fix for memory leak when unmounting video element
export default function useVideoCleanup(videoRef: RefObject<HTMLVideoElement>, dependencies: any[]) {
  useEffect(() => {
    const videoEl = videoRef.current;

    return () => {
      if (videoEl) {
        // It may be slow (specifically on iOS), so we postpone it after unmounting
        requestNextMutation(() => {
          videoEl.pause();
          videoEl.src = '';
          videoEl.load();
        });
      }
    };
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, dependencies);
}
