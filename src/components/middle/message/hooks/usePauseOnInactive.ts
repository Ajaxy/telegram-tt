import { useCallback, useRef } from '../../../../lib/teact/teact';
import { fastRaf } from '../../../../util/schedulers';
import useBackgroundMode from '../../../../hooks/useBackgroundMode';
import safePlay from '../../../../util/safePlay';

export default (playerRef: { current: HTMLVideoElement | null }, isPlayAllowed = false) => {
  const wasPlaying = useRef(false);
  const isFrozen = useRef(false);

  const freezePlaying = useCallback(() => {
    isFrozen.current = true;

    if (!isPlayAllowed || !playerRef.current) {
      return;
    }

    if (!wasPlaying.current) {
      wasPlaying.current = !playerRef.current.paused;
    }

    playerRef.current.pause();
  }, [isPlayAllowed, playerRef]);

  const unfreezePlaying = useCallback(() => {
    // At this point HTMLVideoElement can be unmounted from the DOM
    if (isPlayAllowed && playerRef.current && wasPlaying.current && document.body.contains(playerRef.current)) {
      safePlay(playerRef.current);
    }

    wasPlaying.current = false;
    isFrozen.current = false;
  }, [isPlayAllowed, playerRef]);

  const unfreezePlayingOnRaf = useCallback(() => {
    fastRaf(unfreezePlaying);
  }, [unfreezePlaying]);

  if (!document.hasFocus()) {
    freezePlaying();
  }

  useBackgroundMode(freezePlaying, unfreezePlayingOnRaf);
};
