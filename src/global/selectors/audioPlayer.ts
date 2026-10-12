import type { ApiMessage } from '../../api/types';
import type {
  ChatMediaSearchParams, ChatMediaSearchSegment, PlaybackCapabilities, PlaybackContextType, PlaybackItemRef,
  PlaybackMedia, PlaybackMediaType, PlaybackSource, PlaylistKey,
} from '../../types';
import type { TrackKey } from '../../util/audioPlayback/mediaPool';
import type { GlobalState, TabArgs } from '../types';
import { LoadMoreDirection } from '../../types';

import { MEDIA_PRELOAD_OFFSET } from '../../config';
import {
  makeInstantViewTrackKey, makeMessageTrackKey, makeMusicSearchTrackKey, makeSavedMusicTrackKey,
} from '../../util/audioPlayback/mediaPool';
import { getCurrentTabId } from '../../util/establishMultitabRole';
import { buildSearchResultKey, isSearchResultKey, parseSearchResultKey } from '../../util/keys/searchResultKey';
import { getRichMessageAudios, getWebPageAudio } from '../helpers/messageMedia';
import {
  selectChatMessage, selectChatMessageOrEphemeral, selectFullWebPage, selectWebPageFromMessage,
} from './messages';
import { selectChatMediaSearch } from './middleSearch';
import { selectMusicSearchAudio } from './musicPicker';
import { selectTabState } from './tabs';
import { selectUserFullInfo, selectUserSavedMusic } from './users';

const NEXT_DELTA_BY_SOURCE_TYPE: Record<PlaybackSource['type'], number> = {
  chat: -1,
  globalSearch: 1,
  savedMusic: 1,
  richMessage: 1,
  single: 0,
};

export function selectPlaybackSource<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabState(global, tabId).audioPlayer.source;
}

export function selectPlaybackItem<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
): PlaybackItemRef | undefined {
  return selectTabState(global, tabId).audioPlayer.activeItem;
}

export function selectPlaybackMessage<T extends GlobalState>(global: T, itemRef?: PlaybackItemRef) {
  if (itemRef?.type !== 'message') return undefined;

  return selectChatMessageOrEphemeral(global, itemRef.chatId, itemRef.messageId);
}

export function selectPlaybackMedia<T extends GlobalState>(global: T, itemRef?: PlaybackItemRef) {
  switch (itemRef?.type) {
    case 'message':
      return selectMessagePlaybackMedia(global, itemRef.chatId, itemRef.messageId, itemRef.documentId);
    case 'savedMusic':
      return selectSavedMusicAudio(global, itemRef.peerId, itemRef.audioId);
    case 'instantView':
      return selectInstantViewAudio(global, itemRef.webPageId, itemRef.documentId);
    case 'musicSearch':
      return selectMusicSearchAudio(global, itemRef.audioId);
    default:
      return undefined;
  }
}

// Falls back to the profile strip track, which is known before the saved-music list loads
function selectSavedMusicAudio<T extends GlobalState>(global: T, peerId: string, audioId: string) {
  const audio = selectUserSavedMusic(global, peerId)?.byId[audioId];
  if (audio) return audio;

  const profileAudio = selectUserFullInfo(global, peerId)?.savedMusic;
  return profileAudio?.id === audioId ? profileAudio : undefined;
}

function selectMessagePlaybackMedia<T extends GlobalState>(
  global: T, chatId: string, messageId: number, documentId?: string,
) {
  const message = selectChatMessageOrEphemeral(global, chatId, messageId);
  if (!message) return undefined;

  if (documentId) {
    return message.content.richMessage && getRichMessageAudios(message.content.richMessage).byId[documentId];
  }

  const { audio, voice, video } = message.content;
  return audio || voice || video || getWebPageAudio(selectWebPageFromMessage(global, message));
}

export function selectRichMessageAudios<T extends GlobalState>(global: T, chatId: string, messageId: number) {
  const richMessage = selectChatMessageOrEphemeral(global, chatId, messageId)?.content.richMessage;
  return richMessage && getRichMessageAudios(richMessage);
}

function selectInstantViewAudio<T extends GlobalState>(global: T, webPageId: string, documentId: string) {
  return selectFullWebPage(global, webPageId)?.cachedPageAudioById?.[documentId];
}

export function makeMessageTrackKeyFrom(message: ApiMessage) {
  return makeMessageTrackKey(message.chatId, message.id);
}

export function makeTrackKeyFromItem(itemRef: PlaybackItemRef): TrackKey {
  switch (itemRef.type) {
    case 'message':
      return makeMessageTrackKey(itemRef.chatId, itemRef.messageId, itemRef.documentId);
    case 'savedMusic':
      return makeSavedMusicTrackKey(itemRef.peerId, itemRef.audioId);
    case 'instantView':
      return makeInstantViewTrackKey(itemRef.webPageId, itemRef.documentId);
    case 'musicSearch':
      return makeMusicSearchTrackKey(itemRef.audioId);
  }
}

const MESSAGE_CAPABILITIES: PlaybackCapabilities = { canSeek: true, mediaSession: 'own', withAutoAdvance: true };
const VIEW_ONCE_CAPABILITIES: PlaybackCapabilities = { canSeek: false, mediaSession: 'clear', withAutoAdvance: false };
const SINGLE_CAPABILITIES: PlaybackCapabilities = { canSeek: true, mediaSession: 'own', withAutoAdvance: false };
export const DRAFT_CAPABILITIES: PlaybackCapabilities = { canSeek: true, mediaSession: 'keep', withAutoAdvance: false };

export function getPlaybackCapabilities(
  contextType: PlaybackContextType, options?: { isViewOnce?: boolean; isSingle?: boolean },
): PlaybackCapabilities {
  if (options?.isViewOnce) return VIEW_ONCE_CAPABILITIES;
  if (contextType === 'instantView' || contextType === 'musicSearch' || options?.isSingle) return SINGLE_CAPABILITIES;
  return MESSAGE_CAPABILITIES;
}

const SEGMENT_BY_SEARCH_PARAMS = new WeakMap<ChatMediaSearchParams, {
  messageId: number;
  segment: ChatMediaSearchSegment | undefined;
}>();
const INDEX_BY_KEYS = new WeakMap<readonly PlaylistKey[], { currentKey: PlaylistKey; index: number }>();

export function selectPlaylistSegment<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
): ChatMediaSearchSegment | undefined {
  const { source, activeItem } = selectTabState(global, tabId).audioPlayer;
  if (source?.type !== 'chat' || activeItem?.type !== 'message') return undefined;

  const { messageId } = activeItem;
  const searchParams = selectChatMediaSearch(global, source.chatId, source.threadId, source.mediaType, tabId);
  if (!searchParams) return undefined;

  const memoized = SEGMENT_BY_SEARCH_PARAMS.get(searchParams);
  if (memoized?.messageId === messageId) return memoized.segment;

  const segment = searchParams.currentSegment.foundIds.includes(messageId)
    ? searchParams.currentSegment
    : searchParams.segments.find((currentSegment) => currentSegment.foundIds.includes(messageId));
  SEGMENT_BY_SEARCH_PARAMS.set(searchParams, { messageId, segment });

  return segment;
}

export function selectPlaylistKeys<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
): readonly PlaylistKey[] | undefined {
  const source = selectPlaybackSource(global, tabId);

  switch (source?.type) {
    case 'chat':
      return selectPlaylistSegment(global, tabId)?.foundIds;
    case 'globalSearch':
      return selectTabState(global, tabId).globalSearch.resultsByType?.[source.mediaType]?.foundIds;
    case 'savedMusic':
      return selectUserSavedMusic(global, source.peerId)?.ids;
    case 'richMessage':
      return selectRichMessageAudios(global, source.chatId, source.messageId)?.ids;
    default:
      return undefined;
  }
}

export function selectCurrentPlaylistKey<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
): PlaylistKey | undefined {
  const { source, activeItem } = selectTabState(global, tabId).audioPlayer;

  switch (source?.type) {
    case 'chat':
      return activeItem?.type === 'message' ? activeItem.messageId : undefined;
    case 'globalSearch':
      return activeItem?.type === 'message' ? buildSearchResultKey(activeItem.chatId, activeItem.messageId) : undefined;
    case 'savedMusic':
      return activeItem?.type === 'savedMusic' ? activeItem.audioId : undefined;
    case 'richMessage':
      return activeItem?.type === 'message' ? activeItem.documentId : undefined;
    default:
      return undefined;
  }
}

function selectPlaylistIndex<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const keys = selectPlaylistKeys(global, tabId);
  const currentKey = selectCurrentPlaylistKey(global, tabId);
  if (!keys || currentKey === undefined) return -1;

  const memoized = INDEX_BY_KEYS.get(keys);
  if (memoized?.currentKey === currentKey) return memoized.index;

  const index = keys.indexOf(currentKey);
  INDEX_BY_KEYS.set(keys, { currentKey, index });

  return index;
}

export function selectPlaylistNextDelta<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const source = selectPlaybackSource(global, tabId);
  if (!source) return 0;

  const delta = source.type === 'chat' && source.mediaType === 'voice' ? 1 : NEXT_DELTA_BY_SOURCE_TYPE[source.type];
  const isReversed = global.audioPlayer.orderMode === 'reverse' && selectHasPlaybackModes(global, tabId);

  return isReversed ? -delta : delta;
}

function selectStepIndex<T extends GlobalState>(global: T, isForward: boolean, tabId: number) {
  const keys = selectPlaylistKeys(global, tabId);
  const index = selectPlaylistIndex(global, tabId);
  if (!keys || index === -1) return -1;

  const delta = selectPlaylistNextDelta(global, tabId);
  if (!delta) return -1;

  const step = isForward ? delta : -delta;
  let nextIndex = index + step;
  while (nextIndex >= 0 && nextIndex < keys.length) {
    if (!selectIsSkippedInPlaylist(global, keys[nextIndex], tabId)) return nextIndex;
    nextIndex += step;
  }

  return -1;
}

function selectStepKey<T extends GlobalState>(global: T, isForward: boolean, tabId: number) {
  const keys = selectPlaylistKeys(global, tabId);
  if (!keys) return undefined;

  const stepIndex = selectStepIndex(global, isForward, tabId);
  if (stepIndex !== -1) return keys[stepIndex];

  if (selectIsPlaylistOrphan(global, tabId)) return undefined;

  if (keys.length <= 1 || !selectIsStepEdgeLoaded(global, isForward, tabId)) return undefined;

  return selectPlaylistWrapKey(global, isForward, tabId);
}

export function selectIsPlaylistOrphan<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const currentKey = selectCurrentPlaylistKey(global, tabId);
  if (currentKey === undefined) return false;

  const source = selectPlaybackSource(global, tabId);

  switch (source?.type) {
    case 'chat': {
      const { activeItem } = selectTabState(global, tabId).audioPlayer;
      if (activeItem?.type !== 'message') return false;
      const searchParams = selectChatMediaSearch(global, source.chatId, source.threadId, source.mediaType, tabId);
      if (!searchParams) return false;

      const hasLoadedIds = searchParams.currentSegment.foundIds.length > 0
        || searchParams.segments.some((segment) => segment.foundIds.length > 0);
      if (!hasLoadedIds) return false;

      return !selectPlaylistSegment(global, tabId);
    }
    case 'globalSearch': {
      const foundIds = selectTabState(global, tabId).globalSearch.resultsByType?.[source.mediaType]?.foundIds;
      return Boolean(foundIds) && !foundIds.includes(currentKey as ReturnType<typeof buildSearchResultKey>);
    }
    case 'savedMusic': {
      const savedMusic = selectUserSavedMusic(global, source.peerId);
      return Boolean(savedMusic) && !savedMusic.ids.includes(currentKey as string);
    }
    case 'richMessage': {
      const ids = selectRichMessageAudios(global, source.chatId, source.messageId)?.ids;
      return Boolean(ids) && !ids.includes(currentKey as string);
    }
    default:
      return false;
  }
}

function selectIsPastStart<T extends GlobalState>(global: T, isForward: boolean, tabId: number) {
  const delta = selectPlaylistNextDelta(global, tabId);

  return (isForward ? delta : -delta) < 0;
}

export function selectPlaylistWrapKey<T extends GlobalState>(
  global: T, isForward: boolean, ...[tabId = getCurrentTabId()]: TabArgs<T>
): PlaylistKey | undefined {
  const source = selectPlaybackSource(global, tabId);
  const keys = selectPlaylistKeys(global, tabId);
  if (!source || !keys?.length) return undefined;

  const isPastStart = selectIsPastStart(global, isForward, tabId);

  switch (source.type) {
    case 'chat': {
      const searchParams = selectChatMediaSearch(global, source.chatId, source.threadId, source.mediaType, tabId);
      if (!searchParams) return undefined;

      const isEndLoaded = (segment: ChatMediaSearchSegment) => segment.foundIds.length > 0 && (
        isPastStart ? segment.loadingState.areAllItemsLoadedForwards : segment.loadingState.areAllItemsLoadedBackwards
      );
      const segment = isEndLoaded(searchParams.currentSegment)
        ? searchParams.currentSegment
        : searchParams.segments.find(isEndLoaded);
      if (!segment) return undefined;

      const { foundIds } = segment;
      for (let i = 0; i < foundIds.length; i++) {
        const key = isPastStart ? foundIds[foundIds.length - 1 - i] : foundIds[i];
        if (!selectIsSkippedInPlaylist(global, key, tabId)) return key;
      }

      return undefined;
    }
    case 'savedMusic':
    case 'globalSearch':
    case 'richMessage':
      if (!isPastStart) return keys[0];

      return selectIsPlaylistEdgeLoaded(global, false, tabId) ? keys[keys.length - 1] : undefined;
    default:
      return undefined;
  }
}

export function selectIsWrapTargetMissing<T extends GlobalState>(
  global: T, isForward: boolean, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const keys = selectPlaylistKeys(global, tabId);

  return Boolean(keys && keys.length > 1) && selectPlaylistWrapKey(global, isForward, tabId) === undefined;
}

function selectIsSkippedInPlaylist<T extends GlobalState>(global: T, key: PlaylistKey, tabId: number) {
  const source = selectPlaybackSource(global, tabId);
  if (source?.type !== 'chat' || source.mediaType !== 'voice' || typeof key !== 'number') return false;

  return Boolean(selectChatMessage(global, source.chatId, key)?.content.video?.isRound);
}

function selectIsPlaylistEdgeLoaded<T extends GlobalState>(global: T, isStartEdge: boolean, tabId: number) {
  const source = selectPlaybackSource(global, tabId);

  switch (source?.type) {
    case 'chat': {
      const loadingState = selectPlaylistSegment(global, tabId)?.loadingState;
      return Boolean(isStartEdge ? loadingState?.areAllItemsLoadedBackwards : loadingState?.areAllItemsLoadedForwards);
    }
    case 'savedMusic':
      return isStartEdge || Boolean(selectUserSavedMusic(global, source.peerId)?.isFullyLoaded);
    case 'globalSearch':
      return isStartEdge || selectIsGlobalSearchExhausted(global, source.mediaType, tabId);
    default:
      return true;
  }
}

function selectIsGlobalSearchExhausted<T extends GlobalState>(global: T, mediaType: PlaybackMediaType, tabId: number) {
  const results = selectTabState(global, tabId).globalSearch.resultsByType?.[mediaType];

  return !results || results.totalCount === undefined || results.foundIds.length >= results.totalCount;
}

export function selectIsStepEdgeLoaded<T extends GlobalState>(
  global: T, isForward: boolean, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const delta = selectPlaylistNextDelta(global, tabId);
  if (!delta) return true;

  const step = isForward ? delta : -delta;

  return selectIsPlaylistEdgeLoaded(global, step < 0, tabId);
}

export function selectIsPlaylistFullyLoaded<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectIsPlaylistEdgeLoaded(global, true, tabId) && selectIsPlaylistEdgeLoaded(global, false, tabId);
}

export function selectCurrentTrackKey<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const item = selectPlaybackItem(global, tabId);

  return item && makeTrackKeyFromItem(item);
}

export function selectNextTrackKey<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectStepKey(global, true, tabId);
}

export function selectPrevTrackKey<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectStepKey(global, false, tabId);
}

export function selectIsStepWrapping<T extends GlobalState>(
  global: T, isForward: boolean, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectPlaylistIndex(global, tabId) !== -1 && selectStepIndex(global, isForward, tabId) === -1;
}

export function selectCanWrapPlaylist<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return global.audioPlayer.repeatMode === 'all' && selectHasPlaybackModes(global, tabId);
}

export function selectShuffleState<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabState(global, tabId).audioPlayer.shuffle;
}

export function selectIsShuffling<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return global.audioPlayer.orderMode === 'shuffle' && selectHasPlaybackModes(global, tabId);
}

export function selectShuffleForwardKey<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const shuffle = selectShuffleState(global, tabId);
  if (!shuffle || shuffle.indexInPlayed + 1 >= shuffle.playedKeys.length) return undefined;

  return shuffle.playedKeys[shuffle.indexInPlayed + 1];
}

export function selectShuffleBackwardKey<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const shuffle = selectShuffleState(global, tabId);
  if (!shuffle || shuffle.indexInPlayed <= 0) return undefined;

  return shuffle.playedKeys[shuffle.indexInPlayed - 1];
}

export function selectCanGoNext<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  if (selectIsPlaylistOrphan(global, tabId)) return false;

  if (selectIsShuffling(global, tabId)) {
    const shuffle = selectShuffleState(global, tabId);
    const keys = selectPlaylistKeys(global, tabId);
    if (!shuffle) return Boolean(keys?.length);

    return selectShuffleForwardKey(global, tabId) !== undefined
      || shuffle.nonPlayedKeys.length > 0
      || global.audioPlayer.repeatMode === 'all'
      || Boolean(keys && keys.length > shuffle.playlist.length);
  }

  if (selectIsStepWrapping(global, true, tabId) && !selectCanWrapPlaylist(global, tabId)) {
    return !selectIsStepEdgeLoaded(global, true, tabId);
  }

  return selectNextTrackKey(global, tabId) !== undefined
    || !selectIsStepEdgeLoaded(global, true, tabId)
    || selectIsWrapTargetMissing(global, true, tabId);
}

export function selectCanGoPrev<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  if (selectIsPlaylistOrphan(global, tabId)) return false;

  if (selectIsShuffling(global, tabId)) {
    return selectShuffleBackwardKey(global, tabId) !== undefined;
  }

  if (selectIsStepWrapping(global, false, tabId) && !selectCanWrapPlaylist(global, tabId)) {
    return !selectIsStepEdgeLoaded(global, false, tabId);
  }

  return selectPrevTrackKey(global, tabId) !== undefined
    || !selectIsStepEdgeLoaded(global, false, tabId)
    || selectIsWrapTargetMissing(global, false, tabId);
}

export function selectHasPlaylistWindow<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return Boolean(selectPlaylistSegment(global, tabId)?.foundIds.length);
}

export function selectNextTrackMedia<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
): PlaybackMedia | undefined {
  const source = selectPlaybackSource(global, tabId);
  const nextKey = selectNextTrackKey(global, tabId);
  if (!source || nextKey === undefined) return undefined;

  switch (source.type) {
    case 'chat':
      return typeof nextKey === 'number'
        ? selectMessagePlaybackMedia(global, source.chatId, nextKey)
        : undefined;
    case 'globalSearch': {
      if (!isSearchResultKey(nextKey)) return undefined;

      const [chatId, messageId] = parseSearchResultKey(nextKey);
      return selectMessagePlaybackMedia(global, chatId, messageId);
    }
    case 'savedMusic':
      return typeof nextKey === 'string' ? selectSavedMusicAudio(global, source.peerId, nextKey) : undefined;
    case 'richMessage':
      return typeof nextKey === 'string'
        ? selectMessagePlaybackMedia(global, source.chatId, source.messageId, nextKey)
        : undefined;
    default:
      return undefined;
  }
}

export function selectNextMediaTrackKey<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
): TrackKey | undefined {
  const source = selectPlaybackSource(global, tabId);
  const nextKey = selectNextTrackKey(global, tabId);
  if (!source || nextKey === undefined) return undefined;

  switch (source.type) {
    case 'chat':
      return typeof nextKey === 'number' ? makeMessageTrackKey(source.chatId, nextKey) : undefined;
    case 'globalSearch': {
      if (!isSearchResultKey(nextKey)) return undefined;

      const [chatId, messageId] = parseSearchResultKey(nextKey);
      return makeMessageTrackKey(chatId, messageId);
    }
    case 'savedMusic':
      return typeof nextKey === 'string' ? makeSavedMusicTrackKey(source.peerId, nextKey) : undefined;
    case 'richMessage':
      return typeof nextKey === 'string' ? makeMessageTrackKey(source.chatId, source.messageId, nextKey) : undefined;
    default:
      return undefined;
  }
}

export function selectHasPlaybackModes<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const source = selectPlaybackSource(global, tabId);
  if (!source || source.type === 'single') return false;
  if (source.type === 'richMessage') {
    return (selectRichMessageAudios(global, source.chatId, source.messageId)?.ids.length ?? 0) > 1;
  }

  return source.type === 'savedMusic' || source.mediaType === 'audio';
}

export function selectPlaylistLoadDirection<T extends GlobalState>(
  global: T, isForward: boolean, ...[tabId = getCurrentTabId()]: TabArgs<T>
): LoadMoreDirection | undefined {
  const segment = selectPlaylistSegment(global, tabId);
  if (!segment) return undefined;

  const index = selectPlaylistIndex(global, tabId);
  if (index === -1) return undefined;

  const delta = selectPlaylistNextDelta(global, tabId);
  const step = isForward ? delta : -delta;
  const { areAllItemsLoadedBackwards, areAllItemsLoadedForwards } = segment.loadingState;

  if (step < 0) {
    if (areAllItemsLoadedBackwards || index > MEDIA_PRELOAD_OFFSET) return undefined;
    return LoadMoreDirection.Backwards;
  }

  if (areAllItemsLoadedForwards || index < segment.foundIds.length - 1 - MEDIA_PRELOAD_OFFSET) return undefined;
  return LoadMoreDirection.Forwards;
}
