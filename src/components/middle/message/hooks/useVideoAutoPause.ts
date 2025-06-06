import type { ElementRef } from '../../../../lib/teact/teact';
import { getIsHeavyAnimating, useEffect, useRef } from '../../../../lib/teact/teact';

import { requestMeasure } from '../../../../lib/fasterdom/fasterdom';

import useHeavyAnimation from '../../../../hooks/useHeavyAnimation';
import useLastCallback from '../../../../hooks/useLastCallback';
import usePriorityPlaybackCheck, { isPriorityPlaybackActive } from '../../../../hooks/usePriorityPlaybackCheck';
import useBackgroundMode, { isBackgroundModeActive } from '../../../../hooks/window/useBackgroundMode';

export default function useVideoAutoPause(
  playerRef: ElementRef<HTMLVideoElement>, canPlay: boolean, isPriority?: boolean,
) {
  const canPlayRef = useRef();
  canPlayRef.current = canPlay;

  const { play, pause } = usePlayPause(playerRef);

  const unfreezePlaying = useLastCallback(() => {
    if (canPlayRef.current && (isPriority || !isFrozen())) {
      play();
    }
  });

  const unfreezePlayingOnRaf = useLastCallback(() => {
    requestMeasure(unfreezePlaying);
  });

  useBackgroundMode(pause, unfreezePlayingOnRaf, !canPlay || isPriority);
  useHeavyAnimation(pause, unfreezePlaying, !canPlay || isPriority);
  usePriorityPlaybackCheck(pause, unfreezePlaying, !canPlay || isPriority);

  const handlePlaying = useLastCallback(() => {
    if (!canPlayRef.current || (!isPriority && isFrozen())) {
      pause();
    }
  });

  useEffect(() => {
    if (canPlay) {
      if (isPriority || !isFrozen()) {
        play();
      }
    } else {
      pause();
    }
  }, [canPlay, play, pause, isPriority]);

  return { handlePlaying };
}

function usePlayPause(mediaRef: ElementRef<HTMLMediaElement>) {
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
  return getIsHeavyAnimating() || isPriorityPlaybackActive() || isBackgroundModeActive();
}
