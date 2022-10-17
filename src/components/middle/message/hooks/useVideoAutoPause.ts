import { useCallback, useEffect, useRef } from '../../../../lib/teact/teact';

import { fastRaf } from '../../../../util/schedulers';
import safePlay from '../../../../util/safePlay';
import useBackgroundMode from '../../../../hooks/useBackgroundMode';
import useHeavyAnimationCheck from '../../../../hooks/useHeavyAnimationCheck';

export default function useVideoAutoPause(playerRef: { current: HTMLVideoElement | null }, canPlay: boolean) {
  const canPlayRef = useRef();
  canPlayRef.current = canPlay;

  const isFrozenRef = useRef();

  const freezePlaying = useCallback(() => {
    isFrozenRef.current = true;

    playerRef.current?.pause();
  }, [playerRef]);

  const unfreezePlaying = useCallback(() => {
    isFrozenRef.current = false;

    if (
      playerRef.current && canPlayRef.current
      // At this point `HTMLVideoElement` can be unmounted from the DOM
      && document.body.contains(playerRef.current)
    ) {
      safePlay(playerRef.current);
    }
  }, [playerRef]);

  const unfreezePlayingOnRaf = useCallback(() => {
    fastRaf(unfreezePlaying);
  }, [unfreezePlaying]);

  useBackgroundMode(freezePlaying, unfreezePlayingOnRaf);
  useHeavyAnimationCheck(freezePlaying, unfreezePlaying);

  const handlePlaying = useCallback(() => {
    if (!canPlayRef.current || isFrozenRef.current) {
      playerRef.current!.pause();
    }
  }, [playerRef]);

  useEffect(() => {
    if (!playerRef.current) {
      return;
    }

    if (canPlay) {
      if (!isFrozenRef.current) {
        safePlay(playerRef.current);
      }
    } else {
      playerRef.current!.pause();
    }
  }, [canPlay, playerRef]);

  return { handlePlaying };
}
