import type { PlaybackItemRef, PlaylistKey } from '../../../types';
import type { RequiredGlobalActions } from '../../index';
import type { ActionReturnType, GlobalState } from '../../types';
import { MAIN_THREAD_ID } from '../../../api/types';
import { LoadMoreDirection } from '../../../types';

import {
  CHAT_MEDIA_SLICE,
  MEDIA_PRELOAD_OFFSET,
  PLAYLIST_NEWEST_ANCHOR_ID,
  PLAYLIST_OLDEST_ANCHOR_ID,
  PREVIOUS_RESTART_THRESHOLD,
  SHUFFLE_PLAYLIST_LIMIT,
  SHUFFLE_PRELOAD_THRESHOLD,
} from '../../../config';
import { areDeepEqual } from '../../../util/areDeepEqual';
import * as playbackController from '../../../util/audioPlayback/playbackController';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { isSearchResultKey, parseSearchResultKey } from '../../../util/keys/searchResultKey';
import { hasMessageTtl } from '../../helpers/messages';
import { addActionHandler } from '../../index';
import {
  appendShufflePlaylist,
  clearShuffleStateInAllTabs,
  ensureShuffleMove,
  initShuffleState,
  pushPlayedTrack,
  stepInPlayedHistory,
} from '../../reducers/audioPlayer';
import { updateTabState } from '../../reducers/tabs';
import {
  makeTrackKeyFromItem,
  selectCanWrapPlaylist,
  selectCurrentPlaylistKey,
  selectCurrentTrackKey,
  selectIsPlaylistFullyLoaded,
  selectIsPlaylistOrphan,
  selectIsShuffling,
  selectIsStepEdgeLoaded,
  selectIsStepWrapping,
  selectIsWrapTargetMissing,
  selectNextTrackKey,
  selectPlaybackItem,
  selectPlaybackMessage,
  selectPlaybackSource,
  selectPlaylistKeys,
  selectPlaylistLoadDirection,
  selectPlaylistNextDelta,
  selectPlaylistSegment,
  selectPrevTrackKey,
  selectShuffleBackwardKey,
  selectShuffleForwardKey,
  selectShuffleState,
} from '../../selectors/audioPlayer';
import { selectTabState } from '../../selectors/tabs';

addActionHandler('setAudioPlaybackSource', (global, actions, payload): ActionReturnType => {
  const { source, tabId = getCurrentTabId() } = payload;

  const prevSource = selectPlaybackSource(global, tabId);
  const hasSourceChanged = !areDeepEqual(prevSource, source);

  global = updateTabState(global, {
    audioPlayer: {
      ...selectTabState(global, tabId).audioPlayer,
      source,
      shuffle: hasSourceChanged ? undefined : selectTabState(global, tabId).audioPlayer.shuffle,
    },
  }, tabId);

  return global;
});

addActionHandler('handleAudioPlaybackEnded', (global, actions, payload): ActionReturnType => {
  const { withAutoAdvance, tabId = getCurrentTabId() } = payload;
  if (selectCurrentTrackKey(global, tabId) !== playbackController.getState().trackKey) return;

  if (withAutoAdvance) {
    actions.playNextTrack({ isAuto: true, tabId });
  } else if (selectPlaybackMessage(global, selectPlaybackItem(global, tabId))?.content.video?.isRound) {
    finishPlayback(global, actions, tabId);
  }
});

addActionHandler('playNextTrack', (global, actions, payload): ActionReturnType => {
  const { isAuto, tabId = getCurrentTabId() } = payload || {};

  if (selectIsPlaylistOrphan(global, tabId)) {
    if (isAuto) finishPlayback(global, actions, tabId);
    return undefined;
  }

  if (selectIsShuffling(global, tabId)) {
    global = buildShufflePlaylist(global, tabId);
    if (!selectShuffleState(global, tabId)) return global;

    return playNextShuffled(global, actions, isAuto, tabId);
  }

  const nextKey = selectNextTrackKey(global, tabId);
  if (nextKey === undefined) {
    const isEdgeLoaded = selectIsStepEdgeLoaded(global, true, tabId);
    if (!isEdgeLoaded || selectIsWrapTargetMissing(global, true, tabId)) {
      if (isEdgeLoaded && selectPlaybackSource(global, tabId)?.type === 'globalSearch') {
        if (isAuto) finishOrRestart(global, actions, tabId);
        return undefined;
      }
      return requestPendingStep(global, actions, 'next', isAuto, tabId);
    }
    if (isAuto) finishOrRestart(global, actions, tabId);
    return undefined;
  }

  if (selectIsStepWrapping(global, true, tabId) && !selectCanWrapPlaylist(global, tabId)) {
    if (isAuto) finishPlayback(global, actions, tabId);
    return undefined;
  }

  if (!openTrack(global, actions, nextKey, tabId)) {
    if (isAuto) finishPlayback(global, actions, tabId);
    return undefined;
  }
  loadMorePlaylistIfNeeded(global, actions, true, tabId);

  return undefined;
});

addActionHandler('playPreviousTrack', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  if (selectIsPlaylistOrphan(global, tabId)) return undefined;

  if (playbackController.getOwnerCurrentTime() > PREVIOUS_RESTART_THRESHOLD) {
    playbackController.seekOwner(0);
    return;
  }

  if (selectIsShuffling(global, tabId)) {
    const backwardKey = selectShuffleBackwardKey(global, tabId);
    if (backwardKey === undefined) return;

    global = stepInPlayedHistory(global, -1, tabId);
    openTrack(global, actions, backwardKey, tabId);
    return global;
  }

  if (
    selectIsStepWrapping(global, false, tabId) && !selectCanWrapPlaylist(global, tabId)
    && selectIsStepEdgeLoaded(global, false, tabId)
  ) {
    return undefined;
  }

  const prevKey = selectPrevTrackKey(global, tabId);
  if (prevKey === undefined) {
    const isEdgeLoaded = selectIsStepEdgeLoaded(global, false, tabId);
    if (!isEdgeLoaded || selectIsWrapTargetMissing(global, false, tabId)) {
      if (isEdgeLoaded && selectPlaybackSource(global, tabId)?.type === 'globalSearch') {
        playbackController.seek(0);
        return undefined;
      }
      return requestPendingStep(global, actions, 'prev', undefined, tabId);
    }
    return undefined;
  }

  openTrack(global, actions, prevKey, tabId);
  loadMorePlaylistIfNeeded(global, actions, false, tabId);

  return undefined;
});

addActionHandler('setAudioPlayerRepeatMode', (global, actions, payload): ActionReturnType => {
  const { repeatMode } = payload;

  playbackController.setLoop(repeatMode === 'one');

  const isSingleTrackLoop = repeatMode === 'one';
  global = {
    ...global,
    audioPlayer: {
      ...global.audioPlayer,
      repeatMode,
      orderMode: isSingleTrackLoop ? 'default' : global.audioPlayer.orderMode,
    },
  };

  if (isSingleTrackLoop) {
    return clearShuffleStateInAllTabs(global);
  }

  return global;
});

addActionHandler('setAudioPlayerOrderMode', (global, actions, payload): ActionReturnType => {
  const { orderMode, tabId = getCurrentTabId() } = payload;

  if (orderMode !== 'default' && global.audioPlayer.repeatMode === 'one') {
    playbackController.setLoop(false);
    global = {
      ...global,
      audioPlayer: { ...global.audioPlayer, repeatMode: 'none' },
    };
  }

  global = {
    ...global,
    audioPlayer: { ...global.audioPlayer, orderMode },
  };

  if (orderMode !== 'shuffle') {
    return clearShuffleStateInAllTabs(global);
  }

  actions.loadShufflePlaylist({ tabId });

  return global;
});

addActionHandler('settlePendingPlaylistStep', (global, actions, payload): ActionReturnType => {
  const { shouldContinue, tabId = getCurrentTabId() } = payload;

  const { audioPlayer } = selectTabState(global, tabId);
  const { pendingStep } = audioPlayer;
  if (!pendingStep) return undefined;

  global = updateTabState(global, { audioPlayer: { ...audioPlayer, pendingStep: undefined } }, tabId);

  if (shouldContinue) {
    if (pendingStep.direction === 'next') {
      actions.playNextTrack({ isAuto: pendingStep.isAuto, tabId });
    } else {
      actions.playPreviousTrack({ tabId });
    }
  } else if (pendingStep.isAuto) {
    finishPlayback(global, actions, tabId);
  }

  return global;
});

addActionHandler('openAudioPlaylistModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, { isAudioPlaylistModalOpen: true }, tabId);
});

addActionHandler('closeAudioPlaylistModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, { isAudioPlaylistModalOpen: undefined }, tabId);
});

function openTrack<T extends GlobalState>(
  global: T,
  actions: RequiredGlobalActions,
  key: PlaylistKey,
  tabId: number,
) {
  const source = selectPlaybackSource(global, tabId);
  let item: PlaybackItemRef;

  switch (source?.type) {
    case 'chat':
      if (typeof key !== 'number') return false;
      item = {
        type: 'message', chatId: source.chatId, threadId: source.threadId, messageId: key,
      };
      break;
    case 'globalSearch': {
      if (!isSearchResultKey(key)) return false;
      const [nextChatId, nextMessageId] = parseSearchResultKey(key);
      item = {
        type: 'message', chatId: nextChatId, threadId: MAIN_THREAD_ID, messageId: nextMessageId,
      };
      break;
    }
    case 'savedMusic':
      if (typeof key !== 'string') return false;
      item = { type: 'savedMusic', peerId: source.peerId, audioId: key };
      break;
    case 'richMessage':
      if (typeof key !== 'string') return false;
      item = {
        type: 'message',
        chatId: source.chatId,
        threadId: source.threadId,
        messageId: source.messageId,
        documentId: key,
      };
      break;
    default:
      return false;
  }

  const message = selectPlaybackMessage(global, item);
  // View-once media requires an explicit click in its message
  if (message && hasMessageTtl(message)) return false;

  playbackController.prepareTrackSwitch(makeTrackKeyFromItem(item), message?.content.video?.isRound);
  actions.openAudioPlayer({ item, tabId });
  return true;
}

function finishOrRestart<T extends GlobalState>(global: T, actions: RequiredGlobalActions, tabId: number) {
  if (!selectCanWrapPlaylist(global, tabId)) {
    finishPlayback(global, actions, tabId);
    return;
  }

  playbackController.seek(0);
  playbackController.resume();
}

function finishPlayback<T extends GlobalState>(global: T, actions: RequiredGlobalActions, tabId: number) {
  const source = selectPlaybackSource(global, tabId);
  const message = selectPlaybackMessage(global, selectPlaybackItem(global, tabId));
  if (message?.content.video?.isRound
    || ((source?.type === 'chat' || source?.type === 'globalSearch') && source.mediaType === 'voice')) {
    actions.closeAudioPlayer({ tabId });
    return;
  }

  playbackController.finish();
}

function requestPendingStep<T extends GlobalState>(
  global: T,
  actions: RequiredGlobalActions,
  direction: 'next' | 'prev',
  isAuto: boolean | undefined,
  tabId: number,
) {
  const isForward = direction === 'next';
  if (selectIsStepEdgeLoaded(global, isForward, tabId)) {
    loadPlaylistWrapTarget(global, actions, isForward, tabId);
  } else {
    loadPlaylistEdge(global, actions, isForward, tabId);
  }

  return updateTabState(global, {
    audioPlayer: { ...selectTabState(global, tabId).audioPlayer, pendingStep: { direction, isAuto } },
  }, tabId);
}

function loadPlaylistEdge<T extends GlobalState>(
  global: T,
  actions: RequiredGlobalActions,
  isForward: boolean,
  tabId: number,
) {
  const source = selectPlaybackSource(global, tabId);
  if (source?.type === 'savedMusic') {
    actions.loadSavedMusic({ userId: source.peerId, tabId });
    return;
  }
  if (source?.type === 'globalSearch') {
    actions.searchMessagesGlobal({ type: source.mediaType, tabId });
    return;
  }
  if (source?.type !== 'chat') return;

  const { activeItem } = selectTabState(global, tabId).audioPlayer;
  if (activeItem?.type !== 'message') return;

  const delta = selectPlaylistNextDelta(global, tabId);
  const step = isForward ? delta : -delta;

  actions.searchChatMediaMessages({
    chatId: source.chatId,
    threadId: source.threadId,
    mediaType: source.mediaType,
    currentMediaMessageId: activeItem.messageId,
    direction: step < 0 ? LoadMoreDirection.Backwards : LoadMoreDirection.Forwards,
    tabId,
  });
}

function loadPlaylistWrapTarget<T extends GlobalState>(
  global: T,
  actions: RequiredGlobalActions,
  isForward: boolean,
  tabId: number,
) {
  const source = selectPlaybackSource(global, tabId);
  if (source?.type === 'savedMusic') {
    actions.loadSavedMusic({ userId: source.peerId, tabId });
    return;
  }
  if (source?.type === 'globalSearch') {
    actions.searchMessagesGlobal({ type: source.mediaType, tabId });
    return;
  }
  if (source?.type !== 'chat') return;

  const delta = selectPlaylistNextDelta(global, tabId);
  const isPastStart = (isForward ? delta : -delta) < 0;

  actions.searchChatMediaMessages({
    chatId: source.chatId,
    threadId: source.threadId,
    mediaType: source.mediaType,
    currentMediaMessageId: isPastStart ? PLAYLIST_NEWEST_ANCHOR_ID : PLAYLIST_OLDEST_ANCHOR_ID,
    direction: isPastStart ? LoadMoreDirection.Backwards : LoadMoreDirection.Forwards,
    tabId,
  });
}

function loadMorePlaylistIfNeeded<T extends GlobalState>(
  global: T,
  actions: RequiredGlobalActions,
  isForward: boolean,
  tabId: number,
) {
  const source = selectPlaybackSource(global, tabId);
  if (source?.type === 'globalSearch') {
    const keys = selectPlaylistKeys(global, tabId);
    const currentKey = selectCurrentPlaylistKey(global, tabId);
    const delta = selectPlaylistNextDelta(global, tabId);
    const step = isForward ? delta : -delta;
    if (!keys || currentKey === undefined || step <= 0) return;

    if (keys.length - 1 - keys.indexOf(currentKey) <= MEDIA_PRELOAD_OFFSET) {
      actions.searchMessagesGlobal({ type: source.mediaType, tabId });
    }
    return;
  }
  if (source?.type !== 'chat') return;

  const direction = selectPlaylistLoadDirection(global, isForward, tabId);
  if (direction === undefined) return;

  const { activeItem } = selectTabState(global, tabId).audioPlayer;
  if (activeItem?.type !== 'message') return;

  actions.searchChatMediaMessages({
    chatId: source.chatId,
    threadId: source.threadId,
    mediaType: source.mediaType,
    currentMediaMessageId: activeItem.messageId,
    direction,
    tabId,
  });
}

addActionHandler('loadShufflePlaylist', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  global = buildShufflePlaylist(global, tabId);
  loadMoreForShuffleIfNeeded(global, actions, tabId);

  return global;
});

function buildShufflePlaylist<T extends GlobalState>(global: T, tabId: number): T {
  const keys = selectPlaylistKeys(global, tabId);
  const currentKey = selectCurrentPlaylistKey(global, tabId);
  if (!keys || currentKey === undefined) return global;

  const shuffle = selectShuffleState(global, tabId);
  const areAllLoaded = selectIsPlaylistFullyLoaded(global, tabId);

  return shuffle
    ? appendShufflePlaylist(global, keys, areAllLoaded, tabId)
    : initShuffleState(global, keys, currentKey, areAllLoaded, tabId);
}

function playNextShuffled<T extends GlobalState>(
  global: T, actions: RequiredGlobalActions, isAuto: boolean | undefined, tabId: number,
) {
  const forwardKey = selectShuffleForwardKey(global, tabId);
  if (forwardKey !== undefined) {
    global = stepInPlayedHistory(global, 1, tabId);
    openTrack(global, actions, forwardKey, tabId);
    return global;
  }

  if (global.audioPlayer.repeatMode === 'all') {
    global = ensureShuffleMove(global, tabId);
  }

  const shuffle = selectShuffleState(global, tabId);
  if (!shuffle?.nonPlayedKeys.length) {
    if (isAuto) finishOrRestart(global, actions, tabId);
    return global;
  }

  const nextKey = shuffle.nonPlayedKeys[Math.floor(Math.random() * shuffle.nonPlayedKeys.length)];
  global = pushPlayedTrack(global, nextKey, tabId);
  openTrack(global, actions, nextKey, tabId);
  loadMoreForShuffleIfNeeded(global, actions, tabId);

  return global;
}

function loadMoreForShuffleIfNeeded<T extends GlobalState>(
  global: T, actions: RequiredGlobalActions, tabId: number,
) {
  const shuffle = selectShuffleState(global, tabId);
  if (!shuffle || shuffle.areAllLoaded || shuffle.playlist.length >= SHUFFLE_PLAYLIST_LIMIT
    || shuffle.nonPlayedKeys.length >= SHUFFLE_PRELOAD_THRESHOLD) {
    return;
  }

  loadMoreForShuffle(global, actions, tabId);
}

function loadMoreForShuffle<T extends GlobalState>(
  global: T, actions: RequiredGlobalActions, tabId: number,
) {
  const source = selectPlaybackSource(global, tabId);
  if (source?.type === 'savedMusic') {
    actions.loadSavedMusic({ userId: source.peerId, tabId });
    return;
  }
  if (source?.type === 'globalSearch') {
    actions.searchMessagesGlobal({ type: source.mediaType, tabId });
    return;
  }
  if (source?.type !== 'chat') return;

  const segment = selectPlaylistSegment(global, tabId);
  if (!segment?.foundIds.length) return;

  const { areAllItemsLoadedForwards } = segment.loadingState;

  actions.searchChatMediaMessages({
    chatId: source.chatId,
    threadId: source.threadId,
    mediaType: source.mediaType,
    currentMediaMessageId: areAllItemsLoadedForwards
      ? segment.foundIds[0]
      : segment.foundIds[segment.foundIds.length - 1],
    direction: areAllItemsLoadedForwards ? LoadMoreDirection.Backwards : LoadMoreDirection.Forwards,
    limit: CHAT_MEDIA_SLICE,
    tabId,
  });
}
