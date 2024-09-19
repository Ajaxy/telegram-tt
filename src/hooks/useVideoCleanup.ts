import type { RefObject } from 'react';
import { onFullyIdle, useEffect } from '../lib/teact/teact';

import unloadVideo from '../util/browser/unloadVideo';

// Fix for memory leak when unmounting video element
export default function useVideoCleanup(videoRef: RefObject<HTMLVideoElement>, dependencies: any[]) {
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return undefined;

    return () => {
      // It may be slow (specifically on iOS), so we postpone it after unmounting
      onFullyIdle(() => {
        unloadVideo(videoEl);
      });
    };
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, dependencies);
}
