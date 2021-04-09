import { RefObject } from 'react';
import { useCallback, useRef } from '../lib/teact/teact';

import useHeavyAnimationCheck from './useHeavyAnimationCheck';
import safePlay from '../util/safePlay';

export default function useHeavyAnimationCheckForVideo(playerRef: RefObject<HTMLVideoElement>, shouldPlay: boolean) {
  const shouldPlayRef = useRef();
  shouldPlayRef.current = shouldPlay;

  const pause = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.pause();
    }
  }, [playerRef]);

  const play = useCallback(() => {
    if (playerRef.current && shouldPlayRef.current) {
      safePlay(playerRef.current);
    }
  }, [playerRef]);

  useHeavyAnimationCheck(pause, play);
}
