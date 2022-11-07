import { useCallback, useEffect, useRef } from '../../../../lib/teact/teact';

import { fastRaf } from '../../../../util/schedulers';
import useBackgroundMode from '../../../../hooks/useBackgroundMode';
import useHeavyAnimationCheck from '../../../../hooks/useHeavyAnimationCheck';
import usePlayPause from '../../../../hooks/usePlayPause';

export default function useVideoAutoPause(playerRef: { current: HTMLVideoElement | null }, canPlay: boolean) {
  const canPlayRef = useRef();
  canPlayRef.current = canPlay;

  const { play, pause } = usePlayPause(playerRef);

  const isFrozenRef = useRef();

  const freezePlaying = useCallback(() => {
    isFrozenRef.current = true;

    pause();
  }, [pause]);

  const unfreezePlaying = useCallback(() => {
    isFrozenRef.current = false;

    if (canPlayRef.current) {
      play();
    }
  }, [play]);

  const unfreezePlayingOnRaf = useCallback(() => {
    fastRaf(unfreezePlaying);
  }, [unfreezePlaying]);

  useBackgroundMode(freezePlaying, unfreezePlayingOnRaf);
  useHeavyAnimationCheck(freezePlaying, unfreezePlaying);

  const handlePlaying = useCallback(() => {
    if (!canPlayRef.current || isFrozenRef.current) {
      pause();
    }
  }, [pause]);

  useEffect(() => {
    if (canPlay) {
      if (!isFrozenRef.current) {
        play();
      }
    } else {
      pause();
    }
  }, [canPlay, play, pause]);

  return { handlePlaying };
}
