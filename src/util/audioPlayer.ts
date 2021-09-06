import { getDispatch } from '../lib/teact/teactn';

import { AudioOrigin } from '../types';
import { ApiMessage } from '../api/types';

import { IS_SAFARI } from './environment';
import safePlay from './safePlay';
import { patchSafariProgressiveAudio, isSafariPatchInProgress } from './patchSafariProgressiveAudio';
import { getMessageKey, parseMessageKey } from '../modules/helpers';
import { fastRaf } from './schedulers';

type Handler = (eventName: string, e: Event) => void;
type TrackId = string; // `${MessageKey}-${number}`;

export interface Track {
  audio: HTMLAudioElement;
  proxy: HTMLAudioElement;
  type: 'voice' | 'audio';
  origin: AudioOrigin;
  handlers: Handler[];
  onForcePlay?: NoneToVoidFunction;
  onTrackChange?: NoneToVoidFunction;
}

const tracks = new Map<string, Track>();
let voiceQueue: TrackId[] = [];
let musicQueue: TrackId[] = [];

let currentTrackId: string | undefined;

function createAudio(
  trackId: TrackId,
  type: Track['type'],
  origin: AudioOrigin,
  onForcePlay?: NoneToVoidFunction,
  onTrackChange?: NoneToVoidFunction,
): Track {
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
    if (!tracks.has(trackId)) {
      return;
    }

    if (isSafariPatchInProgress(audio)) {
      return;
    }

    playNext(trackId);
  });

  return {
    audio,
    type,
    proxy: new Proxy(audio, {
      get: (target, key: keyof HTMLAudioElement) => target[key],
    }),
    origin,
    handlers: [],
    onForcePlay,
    onTrackChange,
  };
}

function playNext(trackId: TrackId, isReverseOrder?: boolean) {
  const currentTrack = currentTrackId && tracks.get(currentTrackId);
  if (currentTrack) {
    currentTrack.audio.pause();
    currentTrack.audio.currentTime = 0;
    if (currentTrack.onTrackChange) currentTrack.onTrackChange();
  }

  const track = tracks.get(trackId)!;
  const queue = getTrackQueue(track);
  if (!queue) return;

  const nextTrackId = findNextInQueue(queue, trackId, track.origin, isReverseOrder);
  if (!nextTrackId) {
    return;
  }

  if (!tracks.has(nextTrackId)) {
    // A bit hacky way to continue playlist when switching chat
    getDispatch().openAudioPlayer(parseMessageKey(splitTrackId(nextTrackId).messageKey));

    return;
  }

  const nextTrack = tracks.get(nextTrackId)!;

  if (currentTrack) nextTrack.origin = currentTrack.origin; // Preserve origin

  if (nextTrack.onForcePlay) {
    nextTrack.onForcePlay();
  }

  currentTrackId = nextTrackId;

  if (nextTrack.audio.src) {
    safePlay(nextTrack.audio);
  }
}

export function stopCurrentAudio() {
  const currentTrack = currentTrackId && tracks.get(currentTrackId);
  if (currentTrack) {
    currentTrack.audio.pause();
  }
}

export function register(
  trackId: string,
  trackType: Track['type'],
  origin: AudioOrigin,
  handler: Handler,
  onForcePlay?: NoneToVoidFunction,
  onTrackChange?: NoneToVoidFunction,
) {
  if (!tracks.has(trackId)) {
    const track = createAudio(trackId, trackType, origin, onForcePlay, onTrackChange);
    tracks.set(trackId, track);
    addTrackToQueue(track, trackId);
  }
  const { audio, proxy, handlers } = tracks.get(trackId)!;

  handlers.push(handler);

  return {
    play(src: string) {
      if (!audio.paused) return;
      const currentTrack = currentTrackId && tracks.get(currentTrackId);
      if (currentTrack && currentTrackId !== trackId) {
        currentTrack.audio.pause();
        currentTrack.audio.currentTime = 0;
        if (isSafariPatchInProgress(currentTrack.audio)) {
          currentTrack.audio.dataset.preventPlayAfterPatch = 'true';
        }
        if (currentTrack.onTrackChange) currentTrack.onTrackChange();
      }

      currentTrackId = trackId;

      if (!audio.src) {
        audio.src = src;
        audio.preload = 'auto';

        if (src.includes('/progressive/') && IS_SAFARI) {
          delete audio.dataset.preventPlayAfterPatch;
          patchSafariProgressiveAudio(audio);
        }
      }

      safePlay(audio);
    },

    setCurrentOrigin(audioOrigin: AudioOrigin) {
      tracks.get(trackId)!.origin = audioOrigin;
    },

    pause() {
      if (currentTrackId === trackId) {
        audio.pause();
      }
    },

    stop() {
      if (currentTrackId === trackId) {
        // Hack, reset src to remove default media session notification
        const prevSrc = audio.src;
        audio.pause();
        // onPause not called otherwise, but required to sync UI
        fastRaf(() => {
          audio.src = '';
          audio.src = prevSrc;
        });
      }
    },

    setCurrentTime(time: number) {
      if (currentTrackId === trackId) {
        if (audio.fastSeek) {
          audio.fastSeek(time);
        } else {
          audio.currentTime = time;
        }
      }
    },

    setVolume(volume: number) {
      if (currentTrackId === trackId) {
        audio.volume = volume;
      }
    },

    proxy,

    requestNextTrack() {
      playNext(trackId);
    },

    isLast() {
      const track = tracks.get(trackId)!;
      const queue = getTrackQueue(track);
      if (!queue) return true;
      return !findNextInQueue(queue, trackId, tracks.get(trackId)!.origin);
    },

    isFirst() {
      const track = tracks.get(trackId)!;
      const queue = getTrackQueue(track);
      if (!queue) return true;
      return !findNextInQueue(queue, trackId, tracks.get(trackId)!.origin, true);
    },

    requestPreviousTrack() {
      playNext(trackId, true);
    },

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
          removeFromQueue(track, trackId);
        }

        if (trackId === currentTrackId) {
          currentTrackId = undefined;
        }
      }
    },
  };
}

function getTrackQueue(track: Track) {
  if (track.type === 'audio') {
    return musicQueue;
  }

  if (track.type === 'voice') {
    return voiceQueue;
  }
  return undefined;
}

function addTrackToQueue(track: Track, trackId: TrackId) {
  if (track.type === 'audio' && !musicQueue.includes(trackId)) {
    musicQueue.push(trackId);
    musicQueue.sort(trackIdComparator);
  }

  if (track.type === 'voice' && !voiceQueue.includes(trackId)) {
    voiceQueue.push(trackId);
    voiceQueue.sort(trackIdComparator);
  }
}

function removeFromQueue(track: Track, trackId: TrackId) {
  if (track.type === 'audio') {
    musicQueue = musicQueue.filter((el) => el !== trackId);
  }

  if (track.type === 'voice') {
    voiceQueue = voiceQueue.filter((el) => el !== trackId);
  }
}

function findNextInQueue(queue: TrackId[], current: TrackId, origin: AudioOrigin, isReverseOrder?: boolean) {
  if (origin === AudioOrigin.Search) {
    const index = queue.indexOf(current);
    if (index < 0) return undefined;
    const direction = isReverseOrder ? -1 : 1;
    return queue[index + direction];
  }

  const { chatId } = parseMessageKey(splitTrackId(current).messageKey);
  const chatAudio = queue.filter((id) => id.startsWith(`msg${chatId}`));
  const index = chatAudio.indexOf(current);
  if (index < 0) return undefined;
  let direction = origin === AudioOrigin.Inline ? -1 : 1;
  if (isReverseOrder) direction *= -1;
  return chatAudio[index + direction];
}

export function makeTrackId(message: ApiMessage): TrackId {
  return `${getMessageKey(message)}-${message.date}`;
}

function splitTrackId(trackId: TrackId) {
  const messageKey = trackId.match(/^msg(-?\d+)-(\d+)/)![0];
  const date = Number(trackId.split('-').pop());
  return {
    messageKey,
    date,
  };
}

// Descending order by date
function trackIdComparator(one?: TrackId, two?: TrackId) {
  if (!one || !two) return 0;
  const { date: dateOne, messageKey: keyOne } = splitTrackId(one);
  const { date: dateTwo, messageKey: keyTwo } = splitTrackId(two);
  const diff = dateTwo - dateOne;
  return diff === 0 ? keyTwo.localeCompare(keyOne) : diff;
}
