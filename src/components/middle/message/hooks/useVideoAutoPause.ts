import { useCallback, useRef } from '../../../../lib/teact/teact';

import { fastRaf } from '../../../../util/schedulers';
import safePlay from '../../../../util/safePlay';
import useBackgroundMode from '../../../../hooks/useBackgroundMode';
import useHeavyAnimationCheck from '../../../../hooks/useHeavyAnimationCheck';

export default function useVideoAutoPause(playerRef: { current: HTMLVideoElement | null }, canPlay: boolean) {
  const wasPlaying = useRef(playerRef.current?.paused);
  const canPlayRef = useRef();
  canPlayRef.current = canPlay;

  const isFrozenRef = useRef();

  const freezePlaying = useCallback(() => {
    isFrozenRef.current = true;

    if (!playerRef.current) {
      return;
    }

    wasPlaying.current = !playerRef.current.paused;

    if (wasPlaying.current) {
      playerRef.current.pause();
    }
  }, [playerRef]);

  const unfreezePlaying = useCallback(() => {
    isFrozenRef.current = false;

    if (
      playerRef.current && wasPlaying.current && canPlayRef.current
      // At this point HTMLVideoElement can be unmounted from the DOM
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
    if (isFrozenRef.current) {
      wasPlaying.current = true;
      playerRef.current!.pause();
    }
  }, [playerRef]);

  return { handlePlaying };
}
