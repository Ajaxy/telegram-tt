import { useEffect, useRef } from '../../../../lib/teact/teact';
import { requestMeasure } from '../../../../lib/fasterdom/fasterdom';

import useLastCallback from '../../../../hooks/useLastCallback';
import useBackgroundMode, { isBackgroundModeActive } from '../../../../hooks/useBackgroundMode';
import useHeavyAnimationCheck, { isHeavyAnimating } from '../../../../hooks/useHeavyAnimationCheck';
import usePriorityPlaybackCheck, { isPriorityPlaybackActive } from '../../../../hooks/usePriorityPlaybackCheck';

export default function useVideoAutoPause(playerRef: { current: HTMLVideoElement | null }, canPlay: boolean) {
  const canPlayRef = useRef();
  canPlayRef.current = canPlay;

  const { play, pause } = usePlayPause(playerRef);

  const unfreezePlaying = useLastCallback(() => {
    if (canPlayRef.current && !isFrozen()) {
      play();
    }
  });

  const unfreezePlayingOnRaf = useLastCallback(() => {
    requestMeasure(unfreezePlaying);
  });

  useBackgroundMode(pause, unfreezePlayingOnRaf, !canPlay);
  useHeavyAnimationCheck(pause, unfreezePlaying, !canPlay);
  usePriorityPlaybackCheck(pause, unfreezePlaying, !canPlay);

  const handlePlaying = useLastCallback(() => {
    if (!canPlayRef.current || isFrozen()) {
      pause();
    }
  });

  useEffect(() => {
    if (canPlay) {
      if (!isFrozen()) {
        play();
      }
    } else {
      pause();
    }
  }, [canPlay, play, pause]);

  return { handlePlaying };
}

function usePlayPause(mediaRef: React.RefObject<HTMLMediaElement>) {
  const shouldPauseRef = useRef(false);
  const isLoadingPlayRef = useRef(false);

  const play = useLastCallback(() => {
    shouldPauseRef.current = false;
    if (mediaRef.current && !isLoadingPlayRef.current && document.body.contains(mediaRef.current)) {
      isLoadingPlayRef.current = true;
      mediaRef.current.play().then(() => {
        isLoadingPlayRef.current = false;
        if (shouldPauseRef.current) {
          mediaRef.current?.pause();
          shouldPauseRef.current = false;
        }
      }).catch((e) => {
        // eslint-disable-next-line no-console
        console.warn(e);
      });
    }
  });

  const pause = useLastCallback(() => {
    if (isLoadingPlayRef.current) {
      shouldPauseRef.current = true;
    } else {
      mediaRef.current?.pause();
    }
  });

  return { play, pause };
}

function isFrozen() {
  return isHeavyAnimating() || isPriorityPlaybackActive() || isBackgroundModeActive();
}
