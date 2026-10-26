import { useEffect, useSignal, useState } from '../lib/teact/teact';

import type { PlaybackCapabilities, PlaybackMediaType } from '../types';
import type { TrackKey } from '../util/audioPlayback/mediaPool';

import {
  acquire, onElementDestroy, peek, release,
} from '../util/audioPlayback/mediaPool';
import * as playbackController from '../util/audioPlayback/playbackController';
import { isSafariPatchInProgress } from '../util/patchSafariProgressiveAudio';
import useEffectWithPrevDeps from './useEffectWithPrevDeps';
import useLastCallback from './useLastCallback';

type OwnArgs = {
  trackKey?: TrackKey;
  mediaType: PlaybackMediaType;
  isVideo?: boolean;
  capabilities: PlaybackCapabilities;
  src?: string;
  originalDuration: number;
  metadata?: MediaMetadata;
  shouldPlay?: boolean;
  noProgressUpdates?: boolean;
  withFrameProgress?: boolean;
  onTrackChange?: NoneToVoidFunction;
  onPause?: NoneToVoidFunction;
};

const EVENTS = [
  'play', 'pause', 'timeupdate', 'seeking', 'seeked', 'loadedmetadata', 'durationchange', 'ended', 'error',
] as const;

export default function useAudioPlayback({
  trackKey,
  mediaType,
  isVideo,
  capabilities,
  src,
  originalDuration,
  metadata,
  shouldPlay,
  noProgressUpdates,
  withFrameProgress,
  onTrackChange,
  onPause,
}: OwnArgs) {
  const [isPlaying, setIsPlaying] = useState(() => (
    Boolean(trackKey) && playbackController.isTrackAudiblyPlaying(trackKey)
  ));
  const [audioElement, setAudioElement] = useState<HTMLMediaElement | undefined>(() => (
    trackKey ? peek(trackKey) : undefined
  ));
  const [playProgress, setPlayProgress] = useState(0);
  const [getFrameProgress, setFrameProgress] = useSignal(0);
  const [elementDuration, setElementDuration] = useState(0);
  const [isCurrent, setIsCurrent] = useState(() => (
    Boolean(trackKey) && playbackController.getState().trackKey === trackKey
  ));

  const updatePlayProgress = useLastCallback((progress: number) => {
    setPlayProgress(progress);
    setFrameProgress(progress);
  });

  useEffect(() => {
    if (!trackKey) return undefined;

    setIsCurrent(playbackController.getState().trackKey === trackKey);
    return playbackController.subscribe((state) => {
      const isNowCurrent = state.trackKey === trackKey;
      setIsCurrent(isNowCurrent);
      if (!isNowCurrent) {
        setIsPlaying(false);
        updatePlayProgress(0);
      }
    });
  }, [trackKey]);

  const duration = elementDuration || originalDuration;

  const handleElementEvent = useLastCallback((e: Event) => {
    const element = e.currentTarget as HTMLMediaElement;
    if (isSafariPatchInProgress(element) && e.type !== 'error') return;

    switch (e.type) {
      case 'play':
        setIsPlaying(true);
        break;
      case 'pause':
        setIsPlaying(false);
        onPause?.();
        break;
      case 'loadedmetadata':
      case 'durationchange':
        setElementDuration(Number.isFinite(element.duration) ? element.duration : 0);
        break;
      case 'ended':
      case 'error':
        setIsPlaying(false);
        break;
      case 'timeupdate':
      default: {
        if (noProgressUpdates) break;
        // `pause()` fires `timeupdate` too, which would override a progress preview with the actual position
        if (e.type === 'timeupdate' && element.paused) break;
        updatePlayProgress(getElementProgress(element, originalDuration));
        break;
      }
    }
  });

  const initializeElementProgress = useLastCallback((element: HTMLMediaElement) => {
    if (!noProgressUpdates) updatePlayProgress(getElementProgress(element, originalDuration));
  });

  useEffect(() => {
    if (!trackKey) return undefined;

    let element = acquire(trackKey);

    const attachToElement = () => {
      setAudioElement(element);
      setIsPlaying(!element.paused);
      setElementDuration(Number.isFinite(element.duration) ? element.duration : 0);
      initializeElementProgress(element);
      EVENTS.forEach((event) => element.addEventListener(event, handleElementEvent));
    };
    const detachFromElement = () => {
      EVENTS.forEach((event) => element.removeEventListener(event, handleElementEvent));
    };

    attachToElement();

    const unsubscribeDestroy = onElementDestroy((destroyed) => {
      if (destroyed !== element) return;

      detachFromElement();
      const successor = peek(trackKey);
      if (!successor) return;

      element = successor;
      attachToElement();
    });

    return () => {
      unsubscribeDestroy();
      detachFromElement();
      release(trackKey);
    };
  }, [trackKey]);

  const isProgressShared = isCurrent && capabilities.mediaSession !== 'keep';

  useEffect(() => {
    if (!withFrameProgress || noProgressUpdates || !isProgressShared) return undefined;

    const getSharedProgress = playbackController.getProgressSignal();

    return getSharedProgress.subscribe(() => {
      if (playbackController.getState().trackKey !== trackKey) return;

      if (audioElement?.paused) {
        updatePlayProgress(getSharedProgress());
      } else {
        setFrameProgress(getSharedProgress());
      }
    });
  }, [
    withFrameProgress, noProgressUpdates, isProgressShared, trackKey, audioElement,
    updatePlayProgress, setFrameProgress,
  ]);

  useEffectWithPrevDeps(([prevTrackKey]) => {
    if (prevTrackKey && prevTrackKey !== trackKey) {
      updatePlayProgress(0);
      onTrackChange?.();
    }
  }, [trackKey, onTrackChange]);

  const play = useLastCallback(() => {
    if (!trackKey || !src) return;

    playbackController.playTrack(trackKey, src, {
      mediaType,
      isVideo,
      duration: originalDuration,
      metadata,
      capabilities,
    });
  });

  const pause = useLastCallback(() => {
    if (!trackKey) return;

    if (playbackController.getState().trackKey === trackKey) {
      playbackController.pause();
    } else {
      peek(trackKey)?.pause();
    }
  });

  const playPause = useLastCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  });

  const setCurrentTime = useLastCallback((time: number) => {
    const element = trackKey ? peek(trackKey) : undefined;
    if (!element) return;

    if (element.fastSeek) {
      element.fastSeek(time);
    } else {
      element.currentTime = time;
    }

    updatePlayProgress(getElementProgress(element, originalDuration));
  });

  const previewProgress = useLastCallback((progress: number) => {
    updatePlayProgress(progress);
    if (isProgressShared) playbackController.previewProgress(progress);
  });

  useEffectWithPrevDeps(([prevShouldPlay, prevSrc, prevTrackKey]) => {
    if (prevShouldPlay === shouldPlay && prevSrc === src && prevTrackKey === trackKey) return;
    if (!shouldPlay || !src || !trackKey) return;

    if (playbackController.isTrackAudiblyPlaying(trackKey)) return;

    const element = peek(trackKey);
    if (prevTrackKey === undefined && element?.src && element.paused) return;

    play();
  }, [shouldPlay, src, trackKey]);

  useEffect(() => {
    if (isPlaying && metadata) playbackController.refreshMediaSessionMetadata(metadata);
  }, [isPlaying, metadata]);

  return {
    isPlaying,
    isCurrent,
    playProgress,
    getFrameProgress,
    duration,
    audioElement,
    play,
    pause,
    playPause,
    setCurrentTime,
    previewProgress,
    setVolume: playbackController.setVolume,
    toggleMuted: playbackController.toggleMuted,
    setPlaybackRate: playbackController.setPlaybackRate,
  };
}

function getElementProgress(element: HTMLMediaElement, fallbackDuration: number) {
  const duration = Number.isFinite(element.duration) ? element.duration : fallbackDuration;

  return duration ? element.currentTime / duration : 0;
}
