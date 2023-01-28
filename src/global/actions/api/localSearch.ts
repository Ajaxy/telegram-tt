import {
  addActionHandler, getGlobal, setGlobal,
} from '../../index';

import type { ApiChat } from '../../../api/types';
import { MAIN_THREAD_ID } from '../../../api/types';

import { MESSAGE_SEARCH_SLICE, SHARED_MEDIA_SLICE } from '../../../config';
import { callApi } from '../../../api/gramjs';
import {
  selectCurrentTextSearch,
  selectCurrentMediaSearch,
  selectCurrentMessageList,
  selectChat,
  selectThreadInfo,
} from '../../selectors';
import { buildCollectionByKey } from '../../../util/iteratees';
import {
  addChatMessagesById,
  addChats,
  addUsers,
  updateListedIds,
  updateLocalMediaSearchResults,
  updateLocalTextSearchResults,
} from '../../reducers';
import type { SharedMediaType } from '../../../types';
import type { ActionReturnType, GlobalState, TabArgs } from '../../types';
import { getCurrentTabId } from '../../../util/establishMultitabRole';

addActionHandler('searchTextMessagesLocal', async (global, actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId() } = payload || {};
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  const chat = chatId ? selectChat(global, chatId) : undefined;
  let currentSearch = selectCurrentTextSearch(global, tabId);
  if (!chat || !currentSearch || !threadId) {
    return;
  }

  const { query, results } = currentSearch;
  const offsetId = results?.nextOffsetId;

  let topMessageId: number | undefined;
  if (threadId !== MAIN_THREAD_ID) {
    const threadInfo = selectThreadInfo(global, chatId!, threadId);
    topMessageId = threadInfo?.topMessageId;
  }

  if (!query) {
    return;
  }

  const result = await callApi('searchMessagesLocal', {
    chat,
    type: 'text',
    query,
    topMessageId,
    limit: MESSAGE_SEARCH_SLICE,
    offsetId,
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
  if (!currentSearch || query !== currentSearch.query) {
    return;
  }

  global = addChats(global, buildCollectionByKey(chats, 'id'));
  global = addUsers(global, buildCollectionByKey(users, 'id'));
  global = addChatMessagesById(global, chat.id, byId);
  global = updateLocalTextSearchResults(global, chat.id, threadId, newFoundIds, totalCount, nextOffsetId, tabId);
  setGlobal(global);
});

addActionHandler('searchMediaMessagesLocal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId || !threadId) {
    return;
  }

  const chat = selectChat(global, chatId);
  const currentSearch = selectCurrentMediaSearch(global, tabId);

  if (!chat || !currentSearch) {
    return;
  }

  const { currentType: type, resultsByType } = currentSearch;
  const currentResults = type && resultsByType && resultsByType[type];
  const offsetId = currentResults?.nextOffsetId;

  if (!type) {
    return;
  }

  void searchSharedMedia(global, chat, threadId, type, offsetId, undefined, tabId);
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
  threadId: number,
  type: SharedMediaType,
  offsetId?: number,
  isBudgetPreload = false,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const result = await callApi('searchMessagesLocal', {
    chat,
    type,
    limit: SHARED_MEDIA_SLICE * 2,
    topMessageId: threadId === MAIN_THREAD_ID ? undefined : threadId,
    offsetId,
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

  const currentSearch = selectCurrentMediaSearch(global, tabId);
  if (!currentSearch) {
    return;
  }

  global = addChats(global, buildCollectionByKey(chats, 'id'));
  global = addUsers(global, buildCollectionByKey(users, 'id'));
  global = addChatMessagesById(global, chat.id, byId);
  global = updateLocalMediaSearchResults(global, chat.id, threadId, type, newFoundIds, totalCount, nextOffsetId, tabId);
  global = updateListedIds(global, chat.id, threadId, newFoundIds);
  setGlobal(global);

  if (!isBudgetPreload) {
    void searchSharedMedia(global, chat, threadId, type, nextOffsetId, true, tabId);
  }
}
