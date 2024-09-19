import type { RefObject } from 'react';
import { resolveEventType } from '../lib/teact/dom-events';
import { onFullyIdle, useLayoutEffect } from '../lib/teact/teact';

import unloadVideo from '../util/browser/unloadVideo';
import { useStateRef } from './useStateRef';

// Fix memory leak when unmounting video element
export default function useVideoCleanup(videoRef: RefObject<HTMLVideoElement>, handlers?: Record<string, AnyFunction>) {
  const handlersRef = useStateRef(handlers);

  useLayoutEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return undefined;

    return () => {
      // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
      const handlers2 = handlersRef.current;
      if (handlers2) {
        Object.entries(handlers2).forEach(([key, value]) => {
          videoEl.removeEventListener(resolveEventType(key, videoEl), value, false);
        });
      }

      // It may be slow (specifically on iOS), so we postpone it after unmounting
      onFullyIdle(() => {
        unloadVideo(videoEl);
      });
    };
  }, [handlersRef, videoRef]);
}
