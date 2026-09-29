import { useEffect } from '../lib/teact/teact';
import { getActions } from '../global';

import type { ApiAudio } from '../api/types';

import { onBeforeUnload } from '../util/schedulers';
import { useStateRef } from './useStateRef';

const MIN_REPORTED_DURATION = 3;
const PAUSE_REPORT_DELAY = 60 * 1000;
const MAX_POSITION_TO_TIME_RATIO = 3;

export default function useMusicListenReporting(audio?: ApiAudio, element?: HTMLAudioElement) {
  const { reportMusicListen } = getActions();

  const audioRef = useStateRef(audio);
  const audioId = audio?.id;

  useEffect(() => {
    if (!audioId || !element) return undefined;

    const listenedAudio = audioRef.current!;
    let listenedDuration = 0;
    let lastTime = element.currentTime;
    let lastTimestamp = performance.now();
    let pauseTimeout: number | undefined;

    const report = (isPageUnload?: boolean) => {
      const duration = Math.floor(listenedDuration);
      listenedDuration = 0;
      if (duration >= MIN_REPORTED_DURATION) {
        reportMusicListen({ audio: listenedAudio, listenedDuration: duration, isPageUnload });
      }
    };

    const handleTimeUpdate = () => {
      const now = performance.now();
      const positionDelta = element.currentTime - lastTime;
      const maxDelta = ((now - lastTimestamp) / 1000) * MAX_POSITION_TO_TIME_RATIO;
      if (positionDelta > 0 && positionDelta <= maxDelta && element.readyState > HTMLMediaElement.HAVE_NOTHING) {
        listenedDuration += positionDelta;
      }
      lastTime = element.currentTime;
      lastTimestamp = now;
    };

    const handleSeeking = () => {
      lastTime = element.currentTime;
      lastTimestamp = performance.now();
    };

    const handlePlay = () => {
      window.clearTimeout(pauseTimeout);
    };

    const handlePause = () => {
      pauseTimeout = window.setTimeout(report, PAUSE_REPORT_DELAY);
    };

    const handleEnded = () => {
      window.clearTimeout(pauseTimeout);
      report();
    };

    const handleBeforeUnload = () => {
      report(true);
    };

    element.addEventListener('timeupdate', handleTimeUpdate);
    element.addEventListener('seeking', handleSeeking);
    element.addEventListener('play', handlePlay);
    element.addEventListener('pause', handlePause);
    element.addEventListener('ended', handleEnded);
    const unsubscribeBeforeUnload = onBeforeUnload(handleBeforeUnload);

    return () => {
      element.removeEventListener('timeupdate', handleTimeUpdate);
      element.removeEventListener('seeking', handleSeeking);
      element.removeEventListener('play', handlePlay);
      element.removeEventListener('pause', handlePause);
      element.removeEventListener('ended', handleEnded);
      unsubscribeBeforeUnload();
      window.clearTimeout(pauseTimeout);
      report();
    };
  }, [audioId, element, audioRef, reportMusicListen]);
}
