import { getActions, getGlobal } from '../../global';

import type { PlaybackCapabilities, PlaybackMediaType } from '../../types';
import type { TrackKey } from './mediaPool';

import { PLAYBACK_RATE_FOR_AUDIO_MIN_DURATION } from '../../config';
import { hasMessageTtl, isMessageLocal } from '../../global/helpers/messages';
import {
  selectCanGoNext, selectCanGoPrev, selectCurrentTrackKey, selectPlaybackItem, selectPlaybackMessage,
} from '../../global/selectors/audioPlayer';
import { selectTabState } from '../../global/selectors/tabs';
import { animate } from '../animation';
import { IS_SAFARI } from '../browser/windowEnvironment';
import { createCallbackManager } from '../callbacks';
import {
  clearMediaSession, registerMediaSession, setPlaybackState, setPositionState, updateMetadata,
} from '../mediaSession';
import { isSafariPatchInProgress, patchSafariProgressiveAudio } from '../patchSafariProgressiveAudio';
import safePlay from '../safePlay';
import { fastRaf } from '../schedulers';
import { createSignal } from '../signals';
import {
  acquire, ensureVideo, peek, pin, reassignKey, release,
} from './mediaPool';

const SEEK_OFFSET = 10;
const FRAME_PROGRESS_STEPS = 4096;
const FRAME_PROGRESS_MAX_DURATION = FRAME_PROGRESS_STEPS / 4;
const PROGRESSIVE_URL_MARK = '/progressive/';
const DEFAULT_CAPABILITIES: PlaybackCapabilities = { canSeek: true, mediaSession: 'own', withAutoAdvance: false };

export type PlaybackControllerState = {
  trackKey?: TrackKey;
  mediaType?: PlaybackMediaType;
  isPlaying: boolean;
  duration: number;
};

const [getProgress, setProgress] = createSignal(0);
const listeners = createCallbackManager();

let state: PlaybackControllerState = { isPlaying: false, duration: 0 };
let originalDuration = 0;
let currentMetadata: MediaMetadata | undefined;
let currentCapabilities: PlaybackCapabilities = DEFAULT_CAPABILITIES;
let mediaSessionOwner: {
  key: TrackKey;
  mediaType?: PlaybackMediaType;
  capabilities: PlaybackCapabilities;
  metadata?: MediaMetadata;
} | undefined;
const elementKeys = new WeakMap<HTMLMediaElement, TrackKey>();
let isProgressLoopActive = false;

export function getProgressSignal() {
  return getProgress;
}

export function previewProgress(progress: number) {
  setProgress(progress);
}

export function getState() {
  return state;
}

export function subscribe(listener: (nextState: PlaybackControllerState) => void) {
  return listeners.addCallback(listener);
}

export function playTrack(key: TrackKey, src: string, options: {
  mediaType: PlaybackMediaType;
  isVideo?: boolean;
  duration: number;
  metadata?: MediaMetadata;
  capabilities: PlaybackCapabilities;
}) {
  const {
    mediaType, isVideo, duration, metadata, capabilities,
  } = options;

  if (state.trackKey && state.trackKey !== key) {
    if (capabilities.mediaSession === 'keep') {
      stopElement(state.trackKey);
    } else {
      resetElement(state.trackKey);
    }
  }

  if (isVideo) ensureVideo(key);
  const element = acquire(key);
  if (capabilities.mediaSession === 'keep') {
    release(key);
  } else {
    pin(key);
    release(key);
  }

  bindElement(element);
  elementKeys.set(element, key);
  currentCapabilities = capabilities;

  if (element.getAttribute('src') !== src) {
    element.src = src;
    element.preload = 'auto';
  }

  if (!(element instanceof HTMLVideoElement) && isProgressiveInSafari(src)) {
    delete element.dataset.preventPlayAfterPatch;
    patchSafariProgressiveAudio(element);
  }

  originalDuration = duration;
  currentMetadata = metadata;
  updateState({ trackKey: key, mediaType, duration: getDuration(element) });

  element.loop = capabilities.mediaSession !== 'keep' && mediaType === 'audio'
    && getGlobal().audioPlayer.repeatMode === 'one';
  applyUserPlaybackParams(element);

  if (capabilities.mediaSession === 'own') {
    mediaSessionOwner = {
      key, mediaType, capabilities, metadata,
    };
    registerMediaSession(metadata, buildMediaSessionHandlers());
  } else if (capabilities.mediaSession === 'clear') {
    mediaSessionOwner = undefined;
    clearMediaSession();
  }
  playElement(key, element);
}

export function stopTransientTrack(key: TrackKey) {
  peek(key)?.pause();
  if (state.trackKey !== key) return;

  const ownerElement = mediaSessionOwner && peek(mediaSessionOwner.key);
  const owner = ownerElement ? mediaSessionOwner : undefined;
  const ownerDuration = ownerElement ? getDuration(ownerElement) : 0;
  updateState({
    trackKey: owner?.key, mediaType: owner?.mediaType, isPlaying: false, duration: ownerDuration,
  });
  currentCapabilities = owner?.capabilities || DEFAULT_CAPABILITIES;
  currentMetadata = owner?.metadata;
  setProgress(ownerDuration ? ownerElement!.currentTime / ownerDuration : 0);
  refreshMediaSessionHandlers();
}

export function updateTrackCapabilities(key: TrackKey, capabilities: PlaybackCapabilities) {
  if (state.trackKey === key) {
    currentCapabilities = capabilities;
  }
  if (mediaSessionOwner?.key === key) {
    mediaSessionOwner = { ...mediaSessionOwner, capabilities };
    refreshMediaSessionHandlers();
  }
}

export function renameTrack(oldKey: TrackKey, newKey: TrackKey) {
  if (oldKey === newKey) return;

  reassignKey(oldKey, newKey);

  const element = peek(newKey);
  if (element) elementKeys.set(element, newKey);

  if (state.trackKey === oldKey) {
    updateState({ trackKey: newKey });
  }
  if (mediaSessionOwner?.key === oldKey) {
    mediaSessionOwner = { ...mediaSessionOwner, key: newKey };
  }
}

export function prefetchTrack(key: TrackKey, src: string, isVideo?: boolean) {
  if (isVideo) ensureVideo(key);
  const element = acquire(key);

  if (element.getAttribute('src') !== src) {
    element.preload = 'auto';
    element.src = src;

    if (!(element instanceof HTMLVideoElement) && isProgressiveInSafari(src)) {
      element.dataset.preventPlayAfterPatch = 'true';
      patchSafariProgressiveAudio(element);
    }
  }

  return () => release(key);
}

export function pause() {
  const element = getCurrentElement();
  element?.pause();
}

export function resume() {
  const element = getCurrentElement();
  if (element?.src) safePlay(element);
}

export function stop() {
  const { trackKey } = state;
  if (!trackKey) return;

  resetElement(trackKey);
  unloadElement(trackKey);
  pin(undefined);
  mediaSessionOwner = undefined;
  currentMetadata = undefined;
  currentCapabilities = DEFAULT_CAPABILITIES;
  updateState({
    trackKey: undefined, mediaType: undefined, isPlaying: false, duration: 0,
  });
  setProgress(0);
}

export function finish() {
  const element = getCurrentElement();
  if (!element) return;

  element.pause();
  element.currentTime = 0;
  setProgress(0);
  updateState({ isPlaying: false });
  if (ownsMediaSession(element)) setPlaybackState('paused');
}

export function togglePlayPause() {
  const element = getCurrentElement();
  if (!element) return;

  if (element.paused) {
    safePlay(element);
  } else {
    element.pause();
  }
}

export function isCurrentElementPlaying() {
  const element = getCurrentElement();

  return Boolean(element && !element.paused && !element.ended);
}

export function stopCurrentAudio() {
  getCurrentElement()?.pause();
}

export function prepareTrackSwitch(nextKey?: TrackKey, isVideo?: boolean) {
  if (nextKey && state.trackKey === nextKey) return;

  const outgoingKey = state.trackKey;

  if (nextKey) {
    if (isVideo) ensureVideo(nextKey);
    const nextElement = peek(nextKey);
    if (outgoingKey) resetElement(outgoingKey);
    // Keep the incoming element alive while prefetch consumers release it during the switch
    pin(nextKey);
    if (nextElement) nextElement.currentTime = 0;
    updateState({
      trackKey: nextKey, isPlaying: false, duration: nextElement ? getDuration(nextElement) : 0,
    });
  } else {
    pause();
  }

  setProgress(0);
}

export function isTrackAudiblyPlaying(key: TrackKey) {
  if (state.trackKey !== key) return false;

  const element = peek(key);
  return Boolean(element && !element.paused && !element.ended);
}

export function seek(time: number) {
  if (!currentCapabilities.canSeek) return;

  const element = getCurrentElement();
  if (!element) return;

  if (element.fastSeek) {
    element.fastSeek(time);
  } else {
    element.currentTime = time;
  }

  const duration = getDuration(element);
  if (duration) setProgress(element.currentTime / duration);
}

export function setVolume(volume: number) {
  const element = getCurrentElement();
  if (!element) return;

  element.volume = volume;
  element.muted = false;
}

export function toggleMuted(isMuted?: boolean) {
  const element = getCurrentElement();
  if (!element) return;

  element.muted = isMuted === undefined ? !element.muted : isMuted;
}

export function setPlaybackRate(rate: number) {
  if (currentCapabilities.mediaSession === 'keep') return;

  const element = getCurrentElement();
  if (element) element.playbackRate = rate;
}

export function setLoop(shouldLoop: boolean) {
  if (currentCapabilities.mediaSession === 'keep') return;

  const element = getCurrentElement();
  if (element && state.mediaType === 'audio') element.loop = shouldLoop;
}

export function getCurrentTime() {
  return getCurrentElement()?.currentTime ?? 0;
}

export function getOwnerCurrentTime() {
  return (getOwnerElement() || getCurrentElement())?.currentTime ?? 0;
}

function isProgressiveInSafari(src: string) {
  return IS_SAFARI && src.includes(PROGRESSIVE_URL_MARK);
}

function getCurrentElement() {
  return state.trackKey ? peek(state.trackKey) : undefined;
}

function applyUserPlaybackParams(element: HTMLMediaElement) {
  const global = getGlobal();
  const tabAudioPlayer = selectTabState(global).audioPlayer;

  element.volume = global.audioPlayer.volume;
  element.muted = Boolean(tabAudioPlayer.isMuted);
  if (currentCapabilities.mediaSession === 'keep') {
    element.playbackRate = 1;
  } else {
    applyPlaybackRate(element);
  }
}

function applyPlaybackRate(element: HTMLMediaElement) {
  const tabAudioPlayer = selectTabState(getGlobal()).audioPlayer;
  const duration = getDuration(element) || originalDuration;
  const canApplyRate = state.mediaType === 'voice' || duration > PLAYBACK_RATE_FOR_AUDIO_MIN_DURATION;

  element.playbackRate = canApplyRate && tabAudioPlayer.isPlaybackRateActive ? tabAudioPlayer.playbackRate : 1;
}

function getDuration(element: HTMLMediaElement) {
  return Number.isFinite(element.duration) ? element.duration : 0;
}

function stopElement(key: TrackKey) {
  const element = peek(key);
  if (!element) return;

  element.pause();

  if (isSafariPatchInProgress(element)) {
    element.dataset.preventPlayAfterPatch = 'true';
  }
}

function unloadElement(key: TrackKey) {
  const element = peek(key);
  if (!element || element instanceof HTMLVideoElement) return;

  element.removeAttribute('src');
  element.load();
}

function resetElement(key: TrackKey) {
  const element = peek(key);
  if (!element) return;

  stopElement(key);
  element.currentTime = 0;
}

function updateState(patch: Partial<PlaybackControllerState>) {
  state = { ...state, ...patch };
  listeners.runCallbacks(state);
}

const boundElements = new WeakSet<HTMLMediaElement>();

export function cancelPlaybackIntent(key: TrackKey) {
  if (state.trackKey !== key) return;

  updateState({ isPlaying: false });
  if (mediaSessionOwner?.key === key) setPlaybackState('paused');
}

function playElement(key: TrackKey, element: HTMLMediaElement) {
  element.play().catch(() => {
    cancelPlaybackIntent(key);
  });
}

function isCurrent(element: HTMLMediaElement) {
  const key = elementKeys.get(element);
  return key !== undefined && state.trackKey === key && peek(key) === element;
}

function ownsMediaSession(element: HTMLMediaElement) {
  const key = elementKeys.get(element);
  return key !== undefined && key === mediaSessionOwner?.key && peek(key) === element;
}

function syncPositionState(element: HTMLMediaElement) {
  if (!ownsMediaSession(element)) return;

  setPositionState({
    duration: getDuration(element),
    playbackRate: element.playbackRate,
    position: element.currentTime,
  });
}

function bindElement(element: HTMLMediaElement) {
  if (boundElements.has(element)) return;
  boundElements.add(element);

  element.addEventListener('error', () => {
    const key = elementKeys.get(element);
    if (key !== undefined && isCurrent(element)) cancelPlaybackIntent(key);
  });

  element.addEventListener('play', () => {
    if (!isCurrent(element)) return;
    updateState({ isPlaying: true, duration: getDuration(element) });
    startProgressLoop();
    if (state.mediaType === 'voice') markCurrentMessageRead();
    if (!ownsMediaSession(element)) return;
    registerMediaSession(currentMetadata, buildMediaSessionHandlers());
    setPlaybackState('playing');
    syncPositionState(element);
  });

  element.addEventListener('pause', () => {
    if (isCurrent(element)) updateState({ isPlaying: false });
    if (!ownsMediaSession(element)) return;
    syncPositionState(element);
    setPlaybackState('paused');
  });

  element.addEventListener('seeked', () => {
    syncPositionState(element);

    if (!isCurrent(element) || isSafariPatchInProgress(element)) return;
    if (currentCapabilities.mediaSession === 'keep') return;
    const duration = getDuration(element);
    if (duration) setProgress(element.currentTime / duration);
  });

  element.addEventListener('waiting', () => {
    syncPositionState(element);
  });

  element.addEventListener('playing', () => {
    syncPositionState(element);
  });

  element.addEventListener('ratechange', () => {
    syncPositionState(element);
  });

  element.addEventListener('timeupdate', () => {
    syncPlayingProgress(element);
  });

  element.addEventListener('durationchange', () => {
    if (isCurrent(element)) startProgressLoop();
  });

  element.addEventListener('loadedmetadata', () => {
    if (!isCurrent(element)) return;
    updateState({ duration: getDuration(element) });
    if (currentCapabilities.mediaSession !== 'keep') applyPlaybackRate(element);
    syncPositionState(element);
  });

  element.addEventListener('ended', () => {
    if (!isCurrent(element) || isSafariPatchInProgress(element)) return;
    if (ownsMediaSession(element)) setPlaybackState('paused');
    if (selectCurrentTrackKey(getGlobal()) !== elementKeys.get(element)) return;
    getActions().handleAudioPlaybackEnded({ withAutoAdvance: currentCapabilities.withAutoAdvance });
  });
}

function markCurrentMessageRead() {
  const global = getGlobal();
  if (selectCurrentTrackKey(global) !== state.trackKey) return;

  const item = selectPlaybackItem(global);
  const message = selectPlaybackMessage(global, item);
  if (!message?.isMediaUnread || message.isEphemeral || message.isScheduled
    || (item?.type === 'message' && item.isScheduled)
    || isMessageLocal(message) || hasMessageTtl(message)) return;
  if (message.isOutgoing && message.chatId !== global.currentUserId) return;

  getActions().markMessagesRead({ chatId: message.chatId, messageIds: [message.id] });
}

function startProgressLoop() {
  if (isProgressLoopActive) return;
  isProgressLoopActive = true;

  animate(() => {
    const element = getCurrentElement();
    const duration = element ? getDuration(element) : 0;
    isProgressLoopActive = Boolean(element && !element.paused && !element.ended && !element.error)
      && currentCapabilities.mediaSession !== 'keep' && duration > 0 && duration <= FRAME_PROGRESS_MAX_DURATION;
    if (!isProgressLoopActive) return false;

    syncPlayingProgress(element!, true);
    return true;
  }, fastRaf);
}

function syncPlayingProgress(element: HTMLMediaElement, isFrame?: boolean) {
  if (!isCurrent(element) || isSafariPatchInProgress(element)) return;
  if (element.paused) return;
  if (currentCapabilities.mediaSession === 'keep') return;
  const duration = getDuration(element);
  if (!duration) return;

  const progress = element.currentTime / duration;
  if (!isFrame || Math.abs(progress - getProgress()) * FRAME_PROGRESS_STEPS >= 1) setProgress(progress);
}

function resumeMediaSessionOwner() {
  const owner = mediaSessionOwner;
  if (!owner) return;

  const element = peek(owner.key);

  if (state.trackKey !== undefined && state.trackKey !== owner.key) {
    peek(state.trackKey)?.pause();
    updateState({
      trackKey: owner.key, mediaType: owner.mediaType, duration: element ? getDuration(element) : 0,
    });
    currentCapabilities = owner.capabilities;
    currentMetadata = owner.metadata;
  }

  if (element?.src) safePlay(element);
}

function getOwnerElement() {
  return mediaSessionOwner ? peek(mediaSessionOwner.key) : undefined;
}

export function seekOwner(time: number) {
  const owner = mediaSessionOwner;
  if (owner && !owner.capabilities.canSeek) return;

  const element = owner ? peek(owner.key) : getCurrentElement();
  if (!element) return;

  if (element.fastSeek) {
    element.fastSeek(time);
  } else {
    element.currentTime = time;
  }

  const duration = getDuration(element);
  if ((!owner || state.trackKey === owner.key) && duration) setProgress(element.currentTime / duration);
  syncPositionState(element);
}

function buildMediaSessionHandlers() {
  const global = getGlobal();
  const { canSeek } = mediaSessionOwner?.capabilities || currentCapabilities;

  return {
    play: resumeMediaSessionOwner,
    pause: () => getOwnerElement()?.pause(),
    stop: () => {
      stop();
      getActions().closeAudioPlayer();
    },
    seekbackward: canSeek ? (event: MediaSessionActionDetails) => {
      const element = getOwnerElement();
      if (element) seekOwner(Math.max(element.currentTime - (event.seekOffset || SEEK_OFFSET), 0));
    } : undefined,
    seekforward: canSeek ? (event: MediaSessionActionDetails) => {
      const element = getOwnerElement();
      if (element) seekOwner(Math.min(element.currentTime + (event.seekOffset || SEEK_OFFSET), getDuration(element)));
    } : undefined,
    seekto: canSeek ? (event: MediaSessionActionDetails) => {
      if (event.seekTime !== undefined) seekOwner(event.seekTime);
    } : undefined,
    nexttrack: selectCanGoNext(global) ? () => getActions().playNextTrack({}) : undefined,
    previoustrack: selectCanGoPrev(global) ? () => getActions().playPreviousTrack({}) : undefined,
  };
}

export function refreshMediaSessionHandlers() {
  if (!mediaSessionOwner || state.trackKey !== mediaSessionOwner.key) return;

  registerMediaSession(currentMetadata, buildMediaSessionHandlers());
}

export function refreshMediaSessionMetadata(metadata?: MediaMetadata) {
  if (!mediaSessionOwner || state.trackKey !== mediaSessionOwner.key) return;

  currentMetadata = metadata;
  mediaSessionOwner = { ...mediaSessionOwner, metadata };
  updateMetadata(metadata);
}
