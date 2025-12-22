import { getActions, getGlobal } from '../global';

import type { ApiMessage } from '../api/types';
import type { MessageKey } from './keys/messageKey';
import { AudioOrigin, GlobalSearchContent } from '../types';

import { selectCurrentMessageList, selectTabState } from '../global/selectors';
import { IS_SAFARI } from './browser/windowEnvironment';
import { getMessageServerKey, parseMessageKey } from './keys/messageKey';
import { isSafariPatchInProgress, patchSafariProgressiveAudio } from './patchSafariProgressiveAudio';
import safePlay from './safePlay';

type Handler = (eventName: string, e: Event) => void;
export type TrackId = `${MessageKey}-${number}`;

export interface Track {
  audio: HTMLAudioElement;
  proxy: HTMLAudioElement;
  type: 'voice' | 'audio' | 'oneTimeVoice';
  handlers: Handler[];
  onForcePlay?: NoneToVoidFunction;
  onTrackChange?: NoneToVoidFunction;
}

const tracks = new Map<TrackId, Track>();

let voiceQueue: TrackId[] = [];
let musicQueue: TrackId[] = [];

let currentTrackId: TrackId | undefined;

function createAudio(
  trackId: TrackId,
  type: Track['type'],
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

  const origin = selectTabState(getGlobal()).audioPlayer.origin || AudioOrigin.Inline;

  const nextTrackId = findNextInQueue(trackId, origin, isReverseOrder);
  if (!nextTrackId) {
    return;
  }

  if (!tracks.has(nextTrackId)) {
    // A bit hacky way to continue playlist when switching chat
    getActions().openAudioPlayer(parseMessageKey(splitTrackId(nextTrackId).messageKey));

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
}

export function stopCurrentAudio() {
  const currentTrack = currentTrackId && tracks.get(currentTrackId);
  if (currentTrack) {
    currentTrack.audio.pause();
  }
}

export function register(
  trackId: TrackId,
  trackType: Track['type'],
  handler: Handler,
  onForcePlay?: NoneToVoidFunction,
  onTrackChange?: NoneToVoidFunction,
) {
  if (!tracks.has(trackId)) {
    const track = createAudio(trackId, trackType, onForcePlay, onTrackChange);
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
      cleanUpQueue(trackType, trackId);
    },

    pause() {
      if (currentTrackId === trackId) {
        audio.pause();
      }
    },

    stop() {
      if (currentTrackId === trackId) {
        const prevSrc = audio.src;
        audio.pause();

        // `onPause` is required to reset UI state
        audio.addEventListener('pause', () => {
          // Hack, reset `src` to remove default media session notification
          audio.src = '';
          audio.src = prevSrc;
        }, { once: true });
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
        audio.muted = false;
      }
    },

    setPlaybackRate(rate: number) {
      if (currentTrackId === trackId) {
        audio.playbackRate = rate;
      }
    },

    toggleMuted(muted?: boolean) {
      if (muted === undefined) {
        audio.muted = !audio.muted;
      } else {
        audio.muted = muted;
      }
    },

    proxy,

    requestNextTrack() {
      playNext(trackId);
    },

    isLast() {
      return !findNextInQueue(trackId, selectTabState(getGlobal()).audioPlayer.origin);
    },

    isFirst() {
      return !findNextInQueue(trackId, selectTabState(getGlobal()).audioPlayer.origin, true);
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
  switch (track.type) {
    case 'audio': return musicQueue;
    case 'voice': return voiceQueue;
    default: return undefined;
  }
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
  const trackIdFilter = (el: TrackId) => el !== trackId;
  if (track.type === 'audio') {
    musicQueue = musicQueue.filter(trackIdFilter);
  }

  if (track.type === 'voice') {
    voiceQueue = voiceQueue.filter(trackIdFilter);
  }
}

function cleanUpQueue(type: Track['type'], trackId: TrackId) {
  if (selectTabState(getGlobal()).globalSearch.currentContent === GlobalSearchContent.Music) return;
  const { chatId } = parseMessageKey(splitTrackId(trackId).messageKey);
  const openedChatId = selectCurrentMessageList(getGlobal())?.chatId;
  const queueFilter = (id: string) => (
    id.startsWith(`msg${chatId}`) || (openedChatId && id.startsWith(`msg${openedChatId}`))
  );

  if (type === 'audio') {
    musicQueue = musicQueue.filter(queueFilter);
  }

  if (type === 'voice') {
    voiceQueue = voiceQueue.filter(queueFilter);
  }
}

function findNextInQueue(currentId: TrackId, origin = AudioOrigin.Inline, isReverseOrder?: boolean) {
  const track = tracks.get(currentId)!;
  const queue = getTrackQueue(track);
  if (!queue) return undefined;

  if (origin === AudioOrigin.Search) {
    const index = queue.indexOf(currentId);
    if (index < 0) return undefined;
    const direction = isReverseOrder ? -1 : 1;
    return queue[index + direction];
  }

  const { chatId } = parseMessageKey(splitTrackId(currentId).messageKey);
  const chatAudio = queue.filter((id) => id.startsWith(`msg${chatId}`));
  const index = chatAudio.indexOf(currentId);
  if (index < 0) return undefined;
  let direction = origin === AudioOrigin.Inline ? -1 : 1;
  if (isReverseOrder) direction *= -1;
  return chatAudio[index + direction];
}

export function makeTrackId(message: ApiMessage): TrackId | undefined {
  const key = getMessageServerKey(message);
  if (!key) {
    return undefined;
  }
  return `${key}-${message.date}`;
}

function splitTrackId(trackId: TrackId) {
  const messageKey = trackId.match(/^msg(-?\d+)-(\d+)/)![0] as MessageKey;
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
