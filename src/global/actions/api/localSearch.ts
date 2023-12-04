import type { ApiChat } from '../../../api/types';
import type { SharedMediaType } from '../../../types';
import type { ActionReturnType, GlobalState, TabArgs } from '../../types';

import { MESSAGE_SEARCH_SLICE, SHARED_MEDIA_SLICE } from '../../../config';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { buildCollectionByKey } from '../../../util/iteratees';
import { callApi } from '../../../api/gramjs';
import {
  addActionHandler, getGlobal, setGlobal,
} from '../../index';
import {
  addChatMessagesById,
  addChats,
  addUsers,
  updateLocalMediaSearchResults,
  updateLocalTextSearchResults,
} from '../../reducers';
import {
  selectChat,
  selectCurrentMediaSearch,
  selectCurrentMessageList,
  selectCurrentTextSearch,
} from '../../selectors';

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

  if (!query) {
    return;
  }

  const result = await callApi('searchMessagesLocal', {
    chat,
    type: 'text',
    query,
    threadId,
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
    threadId,
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
  setGlobal(global);

  if (!isBudgetPreload) {
    void searchSharedMedia(global, chat, threadId, type, nextOffsetId, true, tabId);
  }
}
