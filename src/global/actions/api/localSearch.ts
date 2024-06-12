import type { ApiChat } from '../../../api/types';
import type {
  ChatMediaSearchParams, ChatMediaSearchSegment, LoadingState, SharedMediaType, ThreadId,
} from '../../../types';
import type { ActionReturnType, GlobalState, TabArgs } from '../../types';
import { LoadMoreDirection } from '../../../types';

import {
  CHAT_MEDIA_SLICE, MESSAGE_SEARCH_SLICE, SHARED_MEDIA_SLICE,
} from '../../../config';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { buildCollectionByKey, isInsideSortedArrayRange } from '../../../util/iteratees';
import { callApi } from '../../../api/gramjs';
import { getChatMediaMessageIds, getIsSavedDialog, isSameReaction } from '../../helpers';
import {
  addActionHandler, getGlobal, setGlobal,
} from '../../index';
import {
  addChatMessagesById,
  addChats,
  addUsers,
  initializeChatMediaSearchResults,
  mergeWithChatMediaSearchSegment,
  setChatMediaSearchLoading,
  updateChatMediaSearchResults,
  updateLocalTextSearchResults,
  updateSharedMediaSearchResults,
} from '../../reducers';
import {
  selectChat,
  selectCurrentChatMediaSearch,
  selectCurrentMessageList,
  selectCurrentSharedMediaSearch,
  selectCurrentTextSearch,
} from '../../selectors';

const MEDIA_PRELOAD_OFFSET = 9;

addActionHandler('searchTextMessagesLocal', async (global, actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId() } = payload || {};
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};

  if (!chatId) return;

  const currentUserId = global.currentUserId!;
  const isSavedDialog = getIsSavedDialog(chatId, threadId, currentUserId);
  const realChatId = isSavedDialog ? String(threadId) : chatId;

  const chat = realChatId ? selectChat(global, realChatId) : undefined;
  let currentSearch = selectCurrentTextSearch(global, tabId);
  if (!chat || !threadId || !currentSearch) {
    return;
  }

  const { query, results, savedTag } = currentSearch;
  const offsetId = results?.nextOffsetId;

  if (!query && !savedTag) {
    return;
  }

  const result = await callApi('searchMessagesLocal', {
    chat,
    type: 'text',
    query,
    threadId,
    limit: MESSAGE_SEARCH_SLICE,
    offsetId,
    isSavedDialog,
    savedTag,
  });

  if (!result) {
    return;
  }

  const {
    chats, users, messages, totalCount, nextOffsetId,
  } = result;

  const byId = buildCollectionByKey(messages, 'id');
  const newFoundIds = Object.keys(byId).map(Number);

  global = getGlobal();

  currentSearch = selectCurrentTextSearch(global, tabId);
  const hasTagChanged = !isSameReaction(savedTag, currentSearch?.savedTag);
  if (!currentSearch || query !== currentSearch.query || hasTagChanged) {
    return;
  }

  const resultChatId = isSavedDialog ? currentUserId : chat.id;

  global = addChats(global, buildCollectionByKey(chats, 'id'));
  global = addUsers(global, buildCollectionByKey(users, 'id'));
  global = addChatMessagesById(global, resultChatId, byId);
  global = updateLocalTextSearchResults(global, resultChatId, threadId, newFoundIds, totalCount, nextOffsetId, tabId);
  setGlobal(global);
});

addActionHandler('searchSharedMediaMessages', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId || !threadId) {
    return;
  }

  const isSavedDialog = getIsSavedDialog(chatId, threadId, global.currentUserId);
  const realChatId = isSavedDialog ? String(threadId) : chatId;

  const chat = selectChat(global, realChatId);
  const currentSearch = selectCurrentSharedMediaSearch(global, tabId);

  if (!chat || !currentSearch) {
    return;
  }

  const { currentType: type, resultsByType } = currentSearch;
  const currentResults = type && resultsByType && resultsByType[type];
  const offsetId = currentResults?.nextOffsetId;

  if (!type) {
    return;
  }

  void searchSharedMedia(global, chat, threadId, type, offsetId, undefined, isSavedDialog, tabId);
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
  chat: ApiChat,
  threadId: ThreadId,
  type: SharedMediaType,
  offsetId?: number,
  isBudgetPreload = false,
  isSavedDialog?: boolean,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const resultChatId = isSavedDialog ? global.currentUserId! : chat.id;

  const result = await callApi('searchMessagesLocal', {
    chat,
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
    chats, users, messages, totalCount, nextOffsetId,
  } = result;

  const byId = buildCollectionByKey(messages, 'id');
  const newFoundIds = Object.keys(byId).map(Number);

  global = getGlobal();

  const currentSearch = selectCurrentSharedMediaSearch(global, tabId);
  if (!currentSearch) {
    return;
  }

  global = addChats(global, buildCollectionByKey(chats, 'id'));
  global = addUsers(global, buildCollectionByKey(users, 'id'));
  global = addChatMessagesById(global, resultChatId, byId);
  global = updateSharedMediaSearchResults(
    global, resultChatId, threadId, type, newFoundIds, totalCount, nextOffsetId, tabId,
  );
  setGlobal(global);

  if (!isBudgetPreload) {
    void searchSharedMedia(global, chat, threadId, type, nextOffsetId, true, isSavedDialog, tabId);
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
) : number {
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
  direction : LoadMoreDirection,
  limit : number, newFoundIdsCount : number,
  currentSegment?: ChatMediaSearchSegment,
) : LoadingState {
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
  chat: ApiChat,
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

  const resultChatId = isSavedDialog ? global.currentUserId! : chat.id;

  global = setChatMediaSearchLoading(global, resultChatId, threadId, true, tabId);
  setGlobal(global);

  const result = await callApi('searchMessagesLocal', {
    chat,
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
    chats, users, messages,
  } = result;

  const byId = buildCollectionByKey(messages, 'id');
  const newFoundIds = Object.keys(byId).map(Number);

  global = addChats(global, buildCollectionByKey(chats, 'id'));
  global = addUsers(global, buildCollectionByKey(users, 'id'));
  global = addChatMessagesById(global, resultChatId, byId);

  const loadingState = calcLoadingState(direction, limit, newFoundIds.length, currentSegment);

  const filteredIds = getChatMediaMessageIds(byId, newFoundIds, false);
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
