import type {
  ChatMediaSearchParams, ChatMediaSearchSegment, LoadingState, SharedMediaType, ThreadId,
} from '../../../types';
import type { ActionReturnType, GlobalState, TabArgs } from '../../types';
import { type ApiPeer, MAIN_THREAD_ID } from '../../../api/types';
import { LoadMoreDirection } from '../../../types';

import {
  CHAT_MEDIA_SLICE, MESSAGE_SEARCH_SLICE, SHARED_MEDIA_SLICE,
} from '../../../config';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { buildCollectionByKey, isInsideSortedArrayRange } from '../../../util/iteratees';
import { getSearchResultKey } from '../../../util/keys/searchResultKey';
import { callApi } from '../../../api/gramjs';
import { getIsSavedDialog, getMessageContentIds, isSameReaction } from '../../helpers';
import {
  addActionHandler, getGlobal, setGlobal,
} from '../../index';
import {
  addChatMessagesById,
  addMessages,
  addUserStatuses,
  initializeChatMediaSearchResults,
  mergeWithChatMediaSearchSegment,
  setChatMediaSearchLoading,
  updateChatMediaSearchResults,
  updateMiddleSearch,
  updateMiddleSearchResults,
  updateSharedMediaSearchResults,
} from '../../reducers';
import {
  selectChat,
  selectCurrentChatMediaSearch,
  selectCurrentMessageList,
  selectCurrentMiddleSearch,
  selectCurrentSharedMediaSearch,
  selectPeer,
} from '../../selectors';

const MEDIA_PRELOAD_OFFSET = 9;

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
    results, savedTag, type, isHashtag,
  } = currentSearch;
  const shouldReuseParams = results?.query === query;

  const offsetId = shouldReuseParams ? results?.nextOffsetId : undefined;
  const offsetRate = shouldReuseParams ? results?.nextOffsetRate : undefined;
  const offsetPeerId = shouldReuseParams ? results?.nextOffsetPeerId : undefined;
  const offsetPeer = shouldReuseParams && offsetPeerId ? selectChat(global, offsetPeerId) : undefined;

  const shouldHaveQuery = isHashtag || !savedTag;
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
    });
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
    chatId, threadId, currentMediaMessageId, limit, direction, tabId = getCurrentTabId(),
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
  let currentSearch = selectCurrentChatMediaSearch(global, tabId);

  if (!currentSearch) {
    global = initializeChatMediaSearchResults(global, chatId, threadId, tabId);
    setGlobal(global);
    currentSearch = selectCurrentChatMediaSearch(global, tabId);
    if (!currentSearch) {
      return;
    }
    global = getGlobal();
  }

  void searchChatMedia(global,
    chat,
    threadId,
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

function selectCurrentChatMediaSearchSegment(
  params: ChatMediaSearchParams,
  currentMediaMessageId: number,
): ChatMediaSearchSegment | undefined {
  if (isInsideSortedArrayRange(currentMediaMessageId, params.currentSegment.foundIds)) {
    return params.currentSegment;
  }
  const index = params.segments.findIndex(
    (segment) => isInsideSortedArrayRange(currentMediaMessageId, segment.foundIds),
  );

  if (index === -1) {
    if (params.currentSegment && params.currentSegment.foundIds.length) {
      params.segments.push(params.currentSegment);
    }
    return undefined;
  }
  const result = params.segments.splice(index, 1)[0];
  params.segments.push(params.currentSegment);
  return result;
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
  threadId: ThreadId,
  currentMediaMessageId: number,
  chatMediaSearchParams: ChatMediaSearchParams,
  direction?: LoadMoreDirection,
  isSavedDialog?: boolean,
  limit = CHAT_MEDIA_SLICE,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { isSynced } = global;
  if (!isSynced || chatMediaSearchParams.isLoading) {
    return;
  }
  let currentSegment = selectCurrentChatMediaSearchSegment(chatMediaSearchParams, currentMediaMessageId);

  if (direction === undefined) {
    direction = calcLoadMoreDirection(currentMediaMessageId, currentSegment);
  }

  if (direction === undefined) {
    return;
  }

  const offsetId = calcChatMediaSearchOffsetId(direction, currentMediaMessageId, currentSegment);
  const addOffset = calcChatMediaSearchAddOffset(direction, limit);

  const resultChatId = isSavedDialog ? global.currentUserId! : peer.id;

  global = setChatMediaSearchLoading(global, resultChatId, threadId, true, tabId);
  setGlobal(global);

  const result = await callApi('searchMessagesInChat', {
    peer,
    type: 'media',
    limit,
    threadId,
    offsetId,
    isSavedDialog,
    addOffset,
  });

  global = getGlobal();

  if (!result) {
    global = setChatMediaSearchLoading(global, resultChatId, threadId, false, tabId);
    setGlobal(global);
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

  const filteredIds = getMessageContentIds(byId, newFoundIds, 'media');
  currentSegment = mergeWithChatMediaSearchSegment(
    filteredIds,
    loadingState,
    currentSegment,
  );

  global = updateChatMediaSearchResults(
    global, resultChatId, threadId, currentSegment, chatMediaSearchParams, tabId,
  );
  global = setChatMediaSearchLoading(global, resultChatId, threadId, false, tabId);
  setGlobal(global);
}
