import type { RefObject } from 'react';
import { useEffect } from '../lib/teact/teact';

import { requestNextMutation } from '../lib/fasterdom/fasterdom';
import unloadVideo from '../util/browser/unloadVideo';

// Fix for memory leak when unmounting video element
export default function useVideoCleanup(videoRef: RefObject<HTMLVideoElement>, dependencies: any[]) {
  useEffect(() => {
    const videoEl = videoRef.current;

    return () => {
      if (videoEl) {
        // It may be slow (specifically on iOS), so we postpone it after unmounting
        requestNextMutation(() => {
          unloadVideo(videoEl);
        });
      }
    };
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, dependencies);
}
