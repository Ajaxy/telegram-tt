import {
  useCallback, useEffect, useRef, useState,
} from '../lib/teact/teact';

import { register } from '../util/audioPlayer';
import useEffectWithPrevDeps from './useEffectWithPrevDeps';
import { isSafariPatchInProgress } from '../util/patchSafariProgressiveAudio';
import useOnChange from './useOnChange';

type Handler = (e: Event) => void;

export default (
  trackId: string,
  originalDuration: number, // Sometimes incorrect for voice messages
  src?: string,
  handlers?: Record<string, Handler>,
  onInit?: (element: HTMLAudioElement) => void,
  shouldPlay = false,
  onForcePlay?: NoneToVoidFunction,
  noPlaylist = false,
) => {
  // eslint-disable-next-line no-null/no-null
  const controllerRef = useRef<ReturnType<typeof register>>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  let isPlayingSync = isPlaying;

  const [playProgress, setPlayProgress] = useState<number>(0);

  useOnChange(() => {
    controllerRef.current = register(trackId, (eventName, e) => {
      switch (eventName) {
        case 'onPlay':
          setIsPlaying(true);
          break;
        case 'onPause':
          setIsPlaying(false);
          break;
        case 'onTimeUpdate': {
          const { proxy } = controllerRef.current!;
          const duration = proxy.duration && Number.isFinite(proxy.duration) ? proxy.duration : originalDuration;
          setPlayProgress(proxy.currentTime / duration);
          break;
        }
      }

      handlers?.[eventName]?.(e);
    }, onForcePlay);

    const { proxy } = controllerRef.current!;

    if (!isPlaying && !proxy.paused) {
      setIsPlaying(true);
      isPlayingSync = true;
    }

    if (onInit) {
      onInit(proxy);
    }
  }, [trackId]);

  const {
    play, pause, setCurrentTime, proxy, destroy,
  } = controllerRef.current!;
  const duration = proxy.duration && Number.isFinite(proxy.duration) ? proxy.duration : originalDuration;

  // RAF progress
  useEffect(() => {
    if (duration && !isSafariPatchInProgress(proxy)) {
      setPlayProgress(proxy.currentTime / duration);
    }
  }, [duration, playProgress, proxy]);

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

  const playPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else if (src) {
      play(src);
    }
  }, [src, pause, play, isPlaying]);

  return {
    isPlaying: isPlayingSync,
    playProgress,
    playPause,
    setCurrentTime,
    audioProxy: proxy,
    duration,
  };
};
