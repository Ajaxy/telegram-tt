import type {
  ChatMediaSearchParams, ChatMediaSearchSegment, LoadingState, SharedMediaType, ThreadId,
} from '../../../types';
import type { ActionReturnType, GlobalState, TabArgs } from '../../types';
import { type ApiPeer, MAIN_THREAD_ID } from '../../../api/types';
import { LoadMoreDirection } from '../../../types';

import {
  CHAT_MEDIA_SLICE,
  MEDIA_PRELOAD_OFFSET,
  MESSAGE_SEARCH_SLICE,
  PLAYLIST_NEWEST_ANCHOR_ID,
  PLAYLIST_OLDEST_ANCHOR_ID,
  SHARED_MEDIA_SLICE,
} from '../../../config';
import { tryParseDeepLink } from '../../../util/deepLinkParser';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { buildCollectionByKey, isInsideSortedArrayRange } from '../../../util/iteratees';
import { getSearchResultKey } from '../../../util/keys/searchResultKey';
import { callApi } from '../../../api/gramjs';
import { getIsSavedDialog, getMessageContentIds, isSameReaction } from '../../helpers';
import { isApiPeerChat } from '../../helpers/peers';
import {
  addActionHandler, getActions, getGlobal, setGlobal,
} from '../../index';
import {
  addChatMessagesById,
  addMessages,
  addUserStatuses,
  initializeChatMediaSearchResults,
  mergeWithChatMediaSearchSegment,
  setChatMediaSearchLoading,
  updateChatMediaSearchPendingRequest,
  updateChatMediaSearchResults,
  updateMiddleSearch,
  updateMiddleSearchResults,
  updateSharedMediaSearchResults,
} from '../../reducers';
import {
  selectChat,
  selectChatByUsername,
  selectChatMediaSearch,
  selectChatMessage,
  selectCurrentMessageList,
  selectCurrentMiddleSearch,
  selectCurrentSharedMediaSearch,
  selectPeer,
} from '../../selectors';
import { selectPlaybackSource } from '../../selectors/audioPlayer';
import { selectThreadIdFromMessage } from '../../selectors/threads';

addActionHandler('performMiddleSearch', async (global, actions, payload): Promise<void> => {
  const {
    query, chatId, threadId = MAIN_THREAD_ID, tabId = getCurrentTabId(),
  } = payload || {};

  if (!chatId) return;

  const currentUserId = global.currentUserId!;
  const isSavedDialog = getIsSavedDialog(chatId, threadId, currentUserId);
  const realChatId = isSavedDialog ? String(threadId) : chatId;

  const peer = realChatId ? selectPeer(global, realChatId) : undefined;
  let currentSearch = selectCurrentMiddleSearch(global, tabId);
  if (!peer) {
    return;
  }

  if (!currentSearch) {
    global = updateMiddleSearch(global, realChatId, threadId, {}, tabId);
    setGlobal(global);
    global = getGlobal();
  }
  currentSearch = selectCurrentMiddleSearch(global, tabId)!;

  const {
    results, savedTag, type, isHashtag, fromPeerId,
  } = currentSearch;
  const shouldReuseParams = results?.query === query;
  const fromPeer = fromPeerId ? selectPeer(global, fromPeerId) : undefined;

  const offsetId = shouldReuseParams ? results?.nextOffsetId : undefined;
  const offsetRate = shouldReuseParams ? results?.nextOffsetRate : undefined;
  const offsetPeerId = shouldReuseParams ? results?.nextOffsetPeerId : undefined;
  const offsetPeer = shouldReuseParams && offsetPeerId ? selectChat(global, offsetPeerId) : undefined;

  const shouldHaveQuery = isHashtag || (!savedTag && !fromPeerId);
  if (shouldHaveQuery && !query) {
    global = updateMiddleSearch(global, realChatId, threadId, {
      fetchingQuery: undefined,
    }, tabId);
    setGlobal(global);
    return;
  }

  global = updateMiddleSearch(global, realChatId, threadId, {
    fetchingQuery: query,
  }, tabId);
  setGlobal(global);

  let result;
  if (type === 'chat') {
    result = await callApi('searchMessagesInChat', {
      peer,
      type: 'text',
      query: isHashtag ? `#${query}` : query,
      threadId,
      limit: MESSAGE_SEARCH_SLICE,
      offsetId,
      isSavedDialog,
      savedTag,
      fromPeer,
    });

    if (result && query && !isHashtag && !isSavedDialog && isApiPeerChat(peer)) {
      global = getGlobal();
      const link = tryParseDeepLink(query.trim());
      if ((link?.type === 'privateMessageLink' && link.channelId === peer.id)
        || (link?.type === 'publicMessageLink' && selectChatByUsername(global, link.username)?.id === peer.id)) {
        let message = selectChatMessage(global, peer.id, link.messageId);
        if (!message) {
          const messageResult = await callApi('fetchMessage', { chat: peer, messageId: link.messageId });
          message = messageResult !== 'MESSAGE_DELETED' ? messageResult?.message : undefined;
        }

        global = getGlobal();
        result.messages = message && (!fromPeerId || message.senderId === fromPeerId)
          && (threadId === MAIN_THREAD_ID || selectThreadIdFromMessage(global, message) === threadId)
          ? [message] : [];
        result.totalCount = result.messages.length;
        result.nextOffsetId = undefined;
      }
    }
  }

  if (type === 'myChats') {
    result = await callApi('searchMessagesGlobal', {
      type: 'text',
      query: isHashtag ? `#${query}` : query!,
      limit: MESSAGE_SEARCH_SLICE,
      offsetId,
      offsetRate,
      offsetPeer,
    });
  }

  if (type === 'channels') {
    result = await callApi('searchPublicPosts', {
      hashtag: query!,
      limit: MESSAGE_SEARCH_SLICE,
      offsetId,
      offsetPeer,
      offsetRate,
    });
  }

  if (!result) {
    return;
  }

  const {
    userStatusesById, messages, totalCount, nextOffsetId, nextOffsetRate, nextOffsetPeerId,
  } = result;

  const newFoundIds = messages.map(getSearchResultKey);

  global = getGlobal();

  currentSearch = selectCurrentMiddleSearch(global, tabId);
  const hasTagChanged = currentSearch?.savedTag && !isSameReaction(savedTag, currentSearch.savedTag);
  const hasSearchChanged = currentSearch?.fetchingQuery !== query;
  if (!currentSearch || hasSearchChanged || hasTagChanged) {
    return;
  }

  const resultChatId = isSavedDialog ? currentUserId : peer.id;

  global = addUserStatuses(global, userStatusesById);
  global = addMessages(global, messages);
  global = updateMiddleSearch(global, resultChatId, threadId, {
    fetchingQuery: undefined,
  }, tabId);
  global = updateMiddleSearchResults(global, resultChatId, threadId, {
    foundIds: newFoundIds,
    totalCount,
    nextOffsetId,
    nextOffsetRate,
    nextOffsetPeerId,
    query: query || '',
  }, tabId);
  setGlobal(global);
});

addActionHandler('searchHashtag', (global, actions, payload): ActionReturnType => {
  const { hashtag, tabId = getCurrentTabId() } = payload;

  const messageList = selectCurrentMessageList(global, tabId);
  if (!messageList) {
    return;
  }

  const cleanQuery = hashtag.replace(/^#/, '');

  actions.updateMiddleSearch({
    chatId: messageList.chatId,
    threadId: messageList.threadId,
    update: {
      isHashtag: true,
      requestedQuery: cleanQuery,
    },
    tabId,
  });
});

addActionHandler('searchSharedMediaMessages', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId || !threadId) {
    return;
  }

  const isSavedDialog = getIsSavedDialog(chatId, threadId, global.currentUserId);
  const realChatId = isSavedDialog ? String(threadId) : chatId;

  const peer = selectPeer(global, realChatId);
  const currentSearch = selectCurrentSharedMediaSearch(global, tabId);

  if (!peer || !currentSearch) {
    return;
  }

  const { currentType: type, resultsByType } = currentSearch;
  const currentResults = type && resultsByType && resultsByType[type];
  const offsetId = currentResults?.nextOffsetId;

  if (!type) {
    return;
  }

  void searchSharedMedia(global, peer, threadId, type, offsetId, undefined, isSavedDialog, tabId);
});
addActionHandler('searchChatMediaMessages', (global, actions, payload): ActionReturnType => {
  const {
    chatId, threadId, currentMediaMessageId, limit, direction, mediaType = 'media',
    tabId = getCurrentTabId(),
  } = payload;
  if (!chatId || !threadId || !currentMediaMessageId) {
    return;
  }

  const isSavedDialog = getIsSavedDialog(chatId, threadId, global.currentUserId);
  const realChatId = isSavedDialog ? String(threadId) : chatId;

  const chat = selectChat(global, realChatId);
  if (!chat) {
    return;
  }
  let currentSearch = selectChatMediaSearch(global, chatId, threadId, mediaType, tabId);

  if (!currentSearch) {
    global = initializeChatMediaSearchResults(global, chatId, threadId, mediaType, tabId);
    setGlobal(global);
    currentSearch = selectChatMediaSearch(global, chatId, threadId, mediaType, tabId);
    if (!currentSearch) {
      return;
    }
    global = getGlobal();
  }

  void searchChatMedia(global,
    chat,
    chatId,
    threadId,
    mediaType,
    currentMediaMessageId,
    currentSearch,
    direction,
    isSavedDialog,
    limit,
    tabId);
});

addActionHandler('searchMessagesByDate', async (global, actions, payload): Promise<void> => {
  const { timestamp, tabId = getCurrentTabId() } = payload;

  const { chatId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId) {
    return;
  }

  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  const messageId = await callApi('findFirstMessageIdAfterDate', {
    chat,
    timestamp,
  });

  if (!messageId) {
    return;
  }

  actions.focusMessage({
    chatId: chat.id,
    messageId,
    tabId,
  });
});

async function searchSharedMedia<T extends GlobalState>(
  global: T,
  peer: ApiPeer,
  threadId: ThreadId,
  type: SharedMediaType,
  offsetId?: number,
  isBudgetPreload = false,
  isSavedDialog?: boolean,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const resultChatId = isSavedDialog ? global.currentUserId! : peer.id;

  const result = await callApi('searchMessagesInChat', {
    peer,
    type,
    limit: SHARED_MEDIA_SLICE * 2,
    threadId,
    offsetId,
    isSavedDialog,
  });

  if (!result) {
    return;
  }

  const {
    userStatusesById, messages, totalCount, nextOffsetId,
  } = result;

  const byId = buildCollectionByKey(messages, 'id');
  const newFoundIds = Object.keys(byId).map(Number);

  global = getGlobal();

  const currentSearch = selectCurrentSharedMediaSearch(global, tabId);
  if (!currentSearch) {
    return;
  }

  global = addUserStatuses(global, userStatusesById);
  global = addChatMessagesById(global, resultChatId, byId);
  global = updateSharedMediaSearchResults(
    global, resultChatId, threadId, type, newFoundIds, totalCount, nextOffsetId, tabId,
  );
  setGlobal(global);

  if (!isBudgetPreload) {
    void searchSharedMedia(global, peer, threadId, type, nextOffsetId, true, isSavedDialog, tabId);
  }
}

function findChatMediaSearchSegment(
  params: ChatMediaSearchParams,
  currentMediaMessageId: number,
): ChatMediaSearchSegment | undefined {
  if (isInsideSortedArrayRange(currentMediaMessageId, params.currentSegment.foundIds)) {
    return params.currentSegment;
  }

  return params.segments.find((segment) => isInsideSortedArrayRange(currentMediaMessageId, segment.foundIds));
}

function calcChatMediaSearchAddOffset(
  direction: LoadMoreDirection,
  limit: number,
): number {
  if (direction === LoadMoreDirection.Backwards) return 0;
  if (direction === LoadMoreDirection.Forwards) return -(limit + 1);
  return -(Math.round(limit / 2) + 1);
}

function calcChatMediaSearchOffsetId(
  direction: LoadMoreDirection,
  currentMessageId: number,
  segment?: ChatMediaSearchSegment,
): number {
  if (!segment) return currentMessageId;
  if (direction === LoadMoreDirection.Backwards) return segment.foundIds[0];
  if (direction === LoadMoreDirection.Forwards) return segment.foundIds[segment.foundIds.length - 1];
  return currentMessageId;
}

function calcLoadMoreDirection(currentMessageId: number, currentSegment?: ChatMediaSearchSegment) {
  if (!currentSegment) return LoadMoreDirection.Around;
  const currentSegmentFoundIdsCount = currentSegment.foundIds.length;

  const idIndexInSegment = currentSegment.foundIds.indexOf(currentMessageId);
  if (idIndexInSegment === -1) return LoadMoreDirection.Around;

  if (currentSegment.loadingState.areAllItemsLoadedBackwards
    && currentSegment.loadingState.areAllItemsLoadedForwards) {
    return undefined;
  }

  const halfMediaCount = Math.floor(currentSegmentFoundIdsCount / 2);

  const preloadOffset = MEDIA_PRELOAD_OFFSET > halfMediaCount ? 0 : MEDIA_PRELOAD_OFFSET;
  const lastMediaIndex = currentSegmentFoundIdsCount - 1;

  if (idIndexInSegment <= preloadOffset) {
    if (currentSegment.loadingState.areAllItemsLoadedBackwards) return undefined;
    return LoadMoreDirection.Backwards;
  }
  if (idIndexInSegment >= lastMediaIndex - preloadOffset) {
    if (currentSegment.loadingState.areAllItemsLoadedForwards) return undefined;
    return LoadMoreDirection.Forwards;
  }
  return undefined;
}

function calcLoadingState(
  direction: LoadMoreDirection,
  limit: number, newFoundIdsCount: number,
  currentSegment?: ChatMediaSearchSegment,
): LoadingState {
  let areAllItemsLoadedForwards = Boolean(currentSegment?.loadingState.areAllItemsLoadedForwards);
  let areAllItemsLoadedBackwards = Boolean(currentSegment?.loadingState.areAllItemsLoadedBackwards);

  if (newFoundIdsCount < limit) {
    if (direction === LoadMoreDirection.Forwards) {
      areAllItemsLoadedForwards = true;
    } else if (direction === LoadMoreDirection.Backwards) {
      areAllItemsLoadedBackwards = true;
    }
  }
  return {
    areAllItemsLoadedForwards,
    areAllItemsLoadedBackwards,
  };
}

async function searchChatMedia<T extends GlobalState>(
  global: T,
  peer: ApiPeer,
  sourceChatId: string,
  threadId: ThreadId,
  mediaType: SharedMediaType,
  currentMediaMessageId: number,
  chatMediaSearchParams: ChatMediaSearchParams,
  direction?: LoadMoreDirection,
  isSavedDialog?: boolean,
  limit = CHAT_MEDIA_SLICE,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { isSynced } = global;
  if (!isSynced) {
    settlePlayerStepForSearch(sourceChatId, threadId, mediaType, tabId, false);
    return;
  }

  const resultChatId = isSavedDialog ? global.currentUserId! : peer.id;

  if (chatMediaSearchParams.isLoading) {
    global = updateChatMediaSearchPendingRequest(
      global, resultChatId, threadId, mediaType, { currentMediaMessageId, direction }, tabId,
    );
    setGlobal(global);
    return;
  }

  let currentSegment = findChatMediaSearchSegment(chatMediaSearchParams, currentMediaMessageId);

  if (currentSegment && currentSegment !== chatMediaSearchParams.currentSegment) {
    global = updateChatMediaSearchResults(
      global, resultChatId, threadId, mediaType, currentSegment, chatMediaSearchParams, tabId,
    );
    setGlobal(global);
    global = getGlobal();
    chatMediaSearchParams = selectChatMediaSearch(global, resultChatId, threadId, mediaType, tabId)!;
    currentSegment = chatMediaSearchParams.currentSegment;
  }

  const isEdgeAnchor = currentMediaMessageId === PLAYLIST_OLDEST_ANCHOR_ID
    || currentMediaMessageId === PLAYLIST_NEWEST_ANCHOR_ID;

  if (direction === undefined) {
    direction = calcLoadMoreDirection(currentMediaMessageId, currentSegment);
  } else if (!currentSegment && !isEdgeAnchor) {
    direction = LoadMoreDirection.Around;
  }

  if (direction === undefined) {
    settlePlayerStepForSearch(sourceChatId, threadId, mediaType, tabId, false);
    return;
  }

  if (currentSegment && (
    (direction === LoadMoreDirection.Backwards && currentSegment.loadingState.areAllItemsLoadedBackwards)
    || (direction === LoadMoreDirection.Forwards && currentSegment.loadingState.areAllItemsLoadedForwards)
  )) {
    settlePlayerStepForSearch(sourceChatId, threadId, mediaType, tabId, false);
    return;
  }

  const offsetId = calcChatMediaSearchOffsetId(direction, currentMediaMessageId, currentSegment);
  const addOffset = calcChatMediaSearchAddOffset(direction, limit);

  global = setChatMediaSearchLoading(global, resultChatId, threadId, mediaType, true, tabId);
  setGlobal(global);

  const result = await callApi('searchMessagesInChat', {
    peer,
    type: mediaType,
    limit,
    threadId,
    offsetId,
    isSavedDialog,
    addOffset,
  });

  global = getGlobal();

  if (!result) {
    global = setChatMediaSearchLoading(global, resultChatId, threadId, mediaType, false, tabId);
    setGlobal(global);
    const hasQueuedRequest = runPendingChatMediaRequest(global, sourceChatId, resultChatId, threadId, mediaType, tabId);
    if (!hasQueuedRequest) settlePlayerStepForSearch(sourceChatId, threadId, mediaType, tabId, false);
    return;
  }

  const {
    messages, userStatusesById,
  } = result;

  const byId = buildCollectionByKey(messages, 'id');
  const newFoundIds = Object.keys(byId).map(Number);

  global = addUserStatuses(global, userStatusesById);
  global = addChatMessagesById(global, resultChatId, byId);

  const loadingState = calcLoadingState(direction, limit, newFoundIds.length, currentSegment);
  if (!currentSegment && isEdgeAnchor) {
    if (currentMediaMessageId === PLAYLIST_OLDEST_ANCHOR_ID) loadingState.areAllItemsLoadedBackwards = true;
    if (currentMediaMessageId === PLAYLIST_NEWEST_ANCHOR_ID) loadingState.areAllItemsLoadedForwards = true;
  }

  const filteredIds = getMessageContentIds(byId, newFoundIds, mediaType);
  currentSegment = mergeWithChatMediaSearchSegment(
    filteredIds,
    loadingState,
    currentSegment,
  );

  const latestSearchParams = selectChatMediaSearch(global, resultChatId, threadId, mediaType, tabId)
    || chatMediaSearchParams;
  global = updateChatMediaSearchResults(
    global, resultChatId, threadId, mediaType, currentSegment, latestSearchParams, tabId,
  );
  global = setChatMediaSearchLoading(global, resultChatId, threadId, mediaType, false, tabId);
  setGlobal(global);

  const hasQueuedRequest = runPendingChatMediaRequest(global, sourceChatId, resultChatId, threadId, mediaType, tabId);

  if (mediaType === 'media') return;

  if (global.audioPlayer.orderMode === 'shuffle') {
    getActions().loadShufflePlaylist({ tabId });
  }

  if (!hasQueuedRequest) settlePlayerStepForSearch(sourceChatId, threadId, mediaType, tabId, true);
}

function runPendingChatMediaRequest<T extends GlobalState>(
  global: T,
  chatId: string,
  resultChatId: string,
  threadId: ThreadId,
  mediaType: SharedMediaType,
  tabId: number,
) {
  global = getGlobal();
  const pendingRequest = selectChatMediaSearch(global, resultChatId, threadId, mediaType, tabId)?.pendingRequest;
  if (!pendingRequest) return false;

  global = updateChatMediaSearchPendingRequest(global, resultChatId, threadId, mediaType, undefined, tabId);
  setGlobal(global);

  getActions().searchChatMediaMessages({
    chatId,
    threadId,
    mediaType,
    currentMediaMessageId: pendingRequest.currentMediaMessageId,
    direction: pendingRequest.direction,
    tabId,
  });

  return true;
}

function settlePlayerStepForSearch(
  chatId: string,
  threadId: ThreadId,
  mediaType: SharedMediaType,
  tabId: number,
  shouldContinue: boolean,
) {
  if (mediaType === 'media') return;

  const global = getGlobal();
  const source = selectPlaybackSource(global, tabId);
  if (source?.type !== 'chat') return;
  if (source.chatId !== chatId || source.threadId !== threadId || source.mediaType !== mediaType) return;

  getActions().settlePendingPlaylistStep({ shouldContinue, tabId });
}
