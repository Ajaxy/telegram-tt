import { useCallback, useRef } from '../../../../lib/teact/teact';

import { fastRaf } from '../../../../util/schedulers';
import safePlay from '../../../../util/safePlay';
import useBackgroundMode from '../../../../hooks/useBackgroundMode';
import useHeavyAnimationCheck from '../../../../hooks/useHeavyAnimationCheck';

export default function useVideoAutoPause(playerRef: { current: HTMLVideoElement | null }, canPlay: boolean) {
  const wasPlaying = useRef(playerRef.current?.paused);
  const canPlayRef = useRef();
  canPlayRef.current = canPlay;

  const freezePlaying = useCallback(() => {
    if (!playerRef.current) {
      return;
    }

    if (!wasPlaying.current) {
      wasPlaying.current = !playerRef.current.paused;
    }

    playerRef.current.pause();
  }, [playerRef]);

  const unfreezePlaying = useCallback(() => {
    if (
      playerRef.current && wasPlaying.current && canPlayRef.current
      // At this point HTMLVideoElement can be unmounted from the DOM
      && document.body.contains(playerRef.current)
    ) {
      safePlay(playerRef.current);
    }

    wasPlaying.current = false;
  }, [playerRef]);

  const unfreezePlayingOnRaf = useCallback(() => {
    fastRaf(unfreezePlaying);
  }, [unfreezePlaying]);

  useBackgroundMode(freezePlaying, unfreezePlayingOnRaf);
  useHeavyAnimationCheck(freezePlaying, unfreezePlaying);
}
