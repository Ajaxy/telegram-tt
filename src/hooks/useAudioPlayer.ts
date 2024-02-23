import { useEffect, useRef, useState } from '../lib/teact/teact';
import { getActions, getGlobal } from '../global';

import type { Track, TrackId } from '../util/audioPlayer';
import type { MediaSessionHandlers } from '../util/mediaSession';

import { PLAYBACK_RATE_FOR_AUDIO_MIN_DURATION } from '../config';
import { selectTabState } from '../global/selectors';
import { register } from '../util/audioPlayer';
import {
  registerMediaSession, setPlaybackState, setPositionState, updateMetadata,
} from '../util/mediaSession';
import { isSafariPatchInProgress } from '../util/patchSafariProgressiveAudio';
import useEffectWithPrevDeps from './useEffectWithPrevDeps';
import useLastCallback from './useLastCallback';
import useSyncEffect from './useSyncEffect';

type Handler = (e: Event) => void;

const DEFAULT_SKIP_TIME = 10;

const useAudioPlayer = (
  trackId: TrackId,
  originalDuration: number, // Sometimes incorrect for voice messages
  trackType: Track['type'],
  src?: string,
  handlers?: Record<string, Handler>,
  metadata?: MediaMetadata,
  onInit?: (element: HTMLAudioElement) => void,
  shouldPlay = false,
  onForcePlay?: NoneToVoidFunction,
  onTrackChange?: NoneToVoidFunction,
  noPlaylist = false,
  noProgressUpdates = false,
  onPause?: NoneToVoidFunction,
  noReset = false,
  noHandleEvents = false,
) => {
  // eslint-disable-next-line no-null/no-null
  const controllerRef = useRef<ReturnType<typeof register>>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  let isPlayingSync = isPlaying;

  const [playProgress, setPlayProgress] = useState<number>(0);

  const handleTrackChange = useLastCallback(() => {
    setIsPlaying(false);
    if (onTrackChange) onTrackChange();
  });

  useSyncEffect(() => {
    controllerRef.current = register(trackId, trackType, (eventName, e) => {
      if (noHandleEvents) {
        return;
      }
      switch (eventName) {
        case 'onPlay': {
          const {
            setVolume, setPlaybackRate, toggleMuted, proxy,
          } = controllerRef.current!;
          setIsPlaying(true);
          if (trackType !== 'oneTimeVoice') {
            registerMediaSession(metadata, makeMediaHandlers(controllerRef));
          }
          setPlaybackState('playing');
          const { audioPlayer } = selectTabState(getGlobal());
          setVolume(audioPlayer.volume);
          toggleMuted(Boolean(audioPlayer.isMuted));
          const duration = proxy.duration && Number.isFinite(proxy.duration) ? proxy.duration : originalDuration;
          if (trackType === 'voice' || duration > PLAYBACK_RATE_FOR_AUDIO_MIN_DURATION) {
            setPlaybackRate(audioPlayer.playbackRate);
          }
          setPositionState({
            duration: proxy.duration || 0,
            playbackRate: proxy.playbackRate,
            position: proxy.currentTime,
          });
          break;
        }
        case 'onRateChange': {
          const { proxy } = controllerRef.current!;
          setPositionState({
            duration: proxy.duration || 0,
            playbackRate: proxy.playbackRate,
            position: proxy.currentTime,
          });
          break;
        }
        case 'onPause':
          setIsPlaying(false);
          setPlaybackState('paused');
          onPause?.();
          break;
        case 'onTimeUpdate': {
          const { proxy } = controllerRef.current!;
          if (noReset && proxy.currentTime === 0) {
            break;
          }
          const duration = proxy.duration && Number.isFinite(proxy.duration) ? proxy.duration : originalDuration;
          if (!noProgressUpdates) setPlayProgress(proxy.currentTime / duration);
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
      // `isPlayingSync` is only needed to help `setIsPlaying` because it is asynchronous
      // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
      isPlayingSync = true;
    }

    if (onInit && !noHandleEvents) {
      onInit(proxy);
    }
  }, [trackId]);

  useEffect(() => {
    if (isPlaying && metadata) updateMetadata(metadata);
  }, [metadata, isPlaying]);

  const {
    play,
    pause,
    setCurrentTime,
    proxy,
    destroy,
    setVolume,
    stop,
    isFirst,
    isLast,
    requestNextTrack,
    requestPreviousTrack,
    setPlaybackRate,
    toggleMuted,
  } = controllerRef.current!;
  const duration = proxy.duration && Number.isFinite(proxy.duration) ? proxy.duration : originalDuration;

  // RAF progress
  useEffect(() => {
    if (noReset && proxy.currentTime === 0) {
      return;
    }
    if (duration && !isSafariPatchInProgress(proxy) && !noProgressUpdates) {
      setPlayProgress(proxy.currentTime / duration);
    }
  }, [duration, playProgress, proxy, noProgressUpdates, noReset]);

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
  }, [shouldPlay, src, isPlaying, play, proxy.src, proxy.paused, trackType]);

  const playIfPresent = useLastCallback(() => {
    if (src) {
      play(src);
    }
  });

  const playPause = useLastCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      playIfPresent();
    }
  });

  const setTime = useLastCallback((time: number) => {
    setCurrentTime(time);
    if (duration) {
      setPlayProgress(proxy.currentTime / duration);
    }
  });

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
    requestNextTrack,
    requestPreviousTrack,
    isFirst,
    isLast,
    setPlaybackRate,
    toggleMuted,
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
        getActions().closeAudioPlayer();
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

export default useAudioPlayer;
