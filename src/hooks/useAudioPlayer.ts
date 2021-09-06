import {
  useCallback, useEffect, useRef, useState,
} from '../lib/teact/teact';
import { getDispatch } from '../lib/teact/teactn';

import { AudioOrigin } from '../types';

import { register, Track } from '../util/audioPlayer';
import useEffectWithPrevDeps from './useEffectWithPrevDeps';
import { isSafariPatchInProgress } from '../util/patchSafariProgressiveAudio';
import useOnChange from './useOnChange';
import {
  MediaSessionHandlers, registerMediaSession, setPlaybackState, setPositionState, updateMetadata,
} from '../util/mediaSession';

type Handler = (e: Event) => void;

const DEFAULT_SKIP_TIME = 10;

export default (
  trackId: string,
  originalDuration: number, // Sometimes incorrect for voice messages
  trackType: Track['type'],
  origin: AudioOrigin,
  src?: string,
  handlers?: Record<string, Handler>,
  metadata?: MediaMetadata,
  onInit?: (element: HTMLAudioElement) => void,
  shouldPlay = false,
  onForcePlay?: NoneToVoidFunction,
  onTrackChange?: NoneToVoidFunction,
  noPlaylist = false,
  noProgressUpdates = false,
) => {
  // eslint-disable-next-line no-null/no-null
  const controllerRef = useRef<ReturnType<typeof register>>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  let isPlayingSync = isPlaying;

  const [playProgress, setPlayProgress] = useState<number>(0);

  const handleTrackChange = useCallback(() => {
    setIsPlaying(false);
    if (onTrackChange) onTrackChange();
  }, [onTrackChange]);

  useOnChange(() => {
    controllerRef.current = register(trackId, trackType, origin, (eventName, e) => {
      switch (eventName) {
        case 'onPlay':
          setIsPlaying(true);

          registerMediaSession(metadata, makeMediaHandlers(controllerRef));
          setPlaybackState('playing');
          break;
        case 'onPause':
          setIsPlaying(false);
          setPlaybackState('paused');
          break;
        case 'onTimeUpdate': {
          const { proxy } = controllerRef.current!;
          const duration = proxy.duration && Number.isFinite(proxy.duration) ? proxy.duration : originalDuration;
          if (!noProgressUpdates) setPlayProgress(proxy.currentTime / duration);
          setPositionState({
            duration: proxy.duration,
            playbackRate: proxy.playbackRate,
            position: proxy.currentTime,
          });
          break;
        }
        case 'onEnded': {
          setPlaybackState('paused');
          break;
        }
      }

      handlers?.[eventName]?.(e);
    }, onForcePlay, handleTrackChange);

    const { proxy } = controllerRef.current!;

    if (!isPlaying && !proxy.paused) {
      setIsPlaying(true);
      isPlayingSync = true;
    }

    if (onInit) {
      onInit(proxy);
    }
  }, [trackId]);

  useEffect(() => {
    if (isPlaying && metadata) updateMetadata(metadata);
  }, [metadata, isPlaying]);

  const {
    play, pause, setCurrentTime, proxy, destroy, setVolume, setCurrentOrigin, stop,
  } = controllerRef.current!;
  const duration = proxy.duration && Number.isFinite(proxy.duration) ? proxy.duration : originalDuration;

  // RAF progress
  useEffect(() => {
    if (duration && !isSafariPatchInProgress(proxy) && !noProgressUpdates) {
      setPlayProgress(proxy.currentTime / duration);
    }
  }, [duration, playProgress, proxy, noProgressUpdates]);

  // Cleanup
  useEffect(() => () => {
    destroy(noPlaylist);
  }, [destroy, noPlaylist]);

  // Autoplay once `src` is present
  useEffectWithPrevDeps(([prevShouldPlay, prevSrc]) => {
    if (prevShouldPlay === shouldPlay && src === prevSrc) {
      return;
    }

    // When paused by another player
    if (proxy.src && proxy.paused) {
      return;
    }

    if (shouldPlay && src && !isPlaying) {
      play(src);
    }
  }, [shouldPlay, src, isPlaying, play, proxy.src, proxy.paused]);

  const playIfPresent = useCallback(() => {
    if (src) {
      setCurrentOrigin(origin);
      play(src);
    }
  }, [src, origin, play, setCurrentOrigin]);

  const playPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      playIfPresent();
    }
  }, [pause, playIfPresent, isPlaying]);

  const setTime = useCallback((time: number) => {
    setCurrentTime(time);
    if (duration) {
      setPlayProgress(proxy.currentTime / duration);
    }
  }, [duration, proxy, setCurrentTime]);

  return {
    isPlaying: isPlayingSync,
    playProgress,
    playPause,
    pause,
    play: playIfPresent,
    stop,
    setCurrentTime: setTime,
    setVolume,
    audioProxy: proxy,
    duration,
  };
};

function makeMediaHandlers(controllerRef: React.RefObject<ReturnType<typeof register>>) {
  let mediaHandlers: MediaSessionHandlers = {};
  if (controllerRef && controllerRef.current) {
    const {
      play, pause, setCurrentTime, proxy, requestNextTrack, requestPreviousTrack, isFirst, isLast,
    } = controllerRef.current;
    mediaHandlers = {
      play: () => {
        play(proxy.src);
      },
      pause: () => {
        pause();
      },
      stop: () => {
        pause();
        setCurrentTime(0);
        getDispatch().closeAudioPlayer();
      },
      seekbackward: (event) => {
        const skipTime = event.seekOffset || DEFAULT_SKIP_TIME;
        setCurrentTime(Math.max(proxy.currentTime - skipTime, 0));
      },
      seekforward: (event) => {
        const skipTime = event.seekOffset || DEFAULT_SKIP_TIME;
        setCurrentTime(Math.min(proxy.currentTime + skipTime, proxy.duration));
      },
      seekTo: (event) => {
        if (event.seekTime) {
          setCurrentTime(event.seekTime);
        }
      },
    };

    if (!isLast()) {
      mediaHandlers.nexttrack = () => {
        requestNextTrack();
      };
    }
    if (!isFirst()) {
      mediaHandlers.previoustrack = () => {
        requestPreviousTrack();
      };
    }
  }
  return mediaHandlers;
}
