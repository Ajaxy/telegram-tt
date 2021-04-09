import { IS_SAFARI } from './environment';
import safePlay from './safePlay';
import { patchSafariProgressiveAudio, isSafariPatchInProgress } from './patchSafariProgressiveAudio';
import { getDispatch } from '../lib/teact/teactn';
import { parseMessageKey } from '../modules/helpers';

type Handler = (eventName: string, e: Event) => void;

interface Track {
  audio: HTMLAudioElement;
  proxy: HTMLAudioElement;
  handlers: Handler[];
  onForcePlay?: NoneToVoidFunction;
}

const tracks = new Map<string, Track>();
let queue: string[] = [];

let currentTrackId: string | undefined;

function createAudio(trackId: string, onForcePlay?: NoneToVoidFunction) {
  const audio = new Audio();

  function handleEvent(eventName: string) {
    return (e: Event) => {
      if (!tracks.has(trackId)) {
        return;
      }

      if (isSafariPatchInProgress(audio)) {
        return;
      }

      tracks.get(trackId)!.handlers.forEach((handler) => {
        handler(eventName, e);
      });
    };
  }

  audio.addEventListener('timeupdate', handleEvent('onTimeUpdate'));
  audio.addEventListener('play', handleEvent('onPlay'));
  audio.addEventListener('pause', handleEvent('onPause'));
  audio.addEventListener('loadstart', handleEvent('onLoadStart'));
  audio.addEventListener('loadeddata', handleEvent('onLoadedData'));
  audio.addEventListener('playing', handleEvent('onPlaying'));
  audio.addEventListener('ended', () => {
    if (isSafariPatchInProgress(audio)) {
      return;
    }

    const nextTrackId = queue[queue.indexOf(trackId) + 1];
    if (!nextTrackId) {
      return;
    }

    if (!tracks.has(nextTrackId)) {
      // A bit hacky way to continue playlist when switching chat
      getDispatch().openAudioPlayer(parseMessageKey(nextTrackId));

      return;
    }

    const nextTrack = tracks.get(nextTrackId)!;

    if (nextTrack.onForcePlay) {
      nextTrack.onForcePlay();
    }

    currentTrackId = nextTrackId;

    if (nextTrack.audio.src) {
      safePlay(nextTrack.audio);
    }
  });

  return {
    audio,
    proxy: new Proxy(audio, {
      get: (origin, key: keyof HTMLAudioElement) => origin[key],
    }),
    handlers: [],
    onForcePlay,
  };
}

export function stopCurrentAudio() {
  const currentTrack = currentTrackId && tracks.get(currentTrackId);
  if (currentTrack) {
    currentTrack.audio.pause();
  }
}

export function register(trackId: string, handler: Handler, onForcePlay?: NoneToVoidFunction) {
  if (!tracks.has(trackId)) {
    tracks.set(trackId, createAudio(trackId, onForcePlay));

    if (!queue.includes(trackId)) {
      queue.push(trackId);
    }
  }

  const { audio, proxy, handlers } = tracks.get(trackId)!;

  handlers.push(handler);

  return {
    play(src: string) {
      if (currentTrackId && currentTrackId !== trackId) {
        tracks.get(currentTrackId)!.audio.pause();
      }

      currentTrackId = trackId;

      if (!audio.src) {
        audio.src = src;
        audio.preload = 'auto';

        if (src.includes('/progressive/') && IS_SAFARI) {
          patchSafariProgressiveAudio(audio);
        }
      }

      safePlay(audio);
    },

    pause() {
      if (currentTrackId === trackId) {
        audio.pause();
      }
    },

    setCurrentTime(time: number) {
      if (currentTrackId === trackId) {
        audio.currentTime = time;
      }
    },

    proxy,

    destroy(shouldRemoveFromQueue = false) {
      const track = tracks.get(trackId);
      if (!track) {
        return;
      }

      track.handlers = track.handlers.filter((h) => h !== handler);

      if (!track.handlers.length) {
        track.audio.pause();
        tracks.delete(trackId);

        if (shouldRemoveFromQueue) {
          queue = queue.filter((id) => id !== trackId);
        }

        if (trackId === currentTrackId) {
          currentTrackId = undefined;
        }
      }
    },
  };
}
