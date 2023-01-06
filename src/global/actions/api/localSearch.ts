import {
  addActionHandler, getActions, getGlobal, setGlobal,
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

addActionHandler('searchTextMessagesLocal', (global) => {
  const { chatId, threadId } = selectCurrentMessageList(global) || {};
  const chat = chatId ? selectChat(global, chatId) : undefined;
  const currentSearch = selectCurrentTextSearch(global);
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

  void searchTextMessages(chat, threadId, topMessageId, query, offsetId);
});

addActionHandler('searchMediaMessagesLocal', (global) => {
  const { chatId, threadId } = selectCurrentMessageList(global) || {};
  if (!chatId || !threadId) {
    return;
  }

  const chat = selectChat(global, chatId);
  const currentSearch = selectCurrentMediaSearch(global);

  if (!chat || !currentSearch) {
    return;
  }

  const { currentType: type, resultsByType } = currentSearch;
  const currentResults = type && resultsByType && resultsByType[type];
  const offsetId = currentResults?.nextOffsetId;

  if (!type) {
    return;
  }

  void searchSharedMedia(chat, threadId, type, offsetId);
});

addActionHandler('searchMessagesByDate', (global, actions, payload) => {
  const { timestamp } = payload!;

  const { chatId } = selectCurrentMessageList(global) || {};
  if (!chatId) {
    return;
  }

  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  void searchMessagesByDate(chat, timestamp);
});

async function searchTextMessages(
  chat: ApiChat,
  threadId: number,
  topMessageId?: number,
  query?: string,
  offsetId?: number,
) {
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

  let global = getGlobal();

  const currentSearch = selectCurrentTextSearch(global);
  if (!currentSearch || query !== currentSearch.query) {
    return;
  }

  global = addChats(global, buildCollectionByKey(chats, 'id'));
  global = addUsers(global, buildCollectionByKey(users, 'id'));
  global = addChatMessagesById(global, chat.id, byId);
  global = updateLocalTextSearchResults(global, chat.id, threadId, newFoundIds, totalCount, nextOffsetId);
  setGlobal(global);
}

async function searchSharedMedia(
  chat: ApiChat,
  threadId: number,
  type: SharedMediaType,
  offsetId?: number,
  isBudgetPreload = false,
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

  let global = getGlobal();

  const currentSearch = selectCurrentMediaSearch(global);
  if (!currentSearch) {
    return;
  }

  global = addChats(global, buildCollectionByKey(chats, 'id'));
  global = addUsers(global, buildCollectionByKey(users, 'id'));
  global = addChatMessagesById(global, chat.id, byId);
  global = updateLocalMediaSearchResults(global, chat.id, threadId, type, newFoundIds, totalCount, nextOffsetId);
  global = updateListedIds(global, chat.id, threadId, newFoundIds);
  setGlobal(global);

  if (!isBudgetPreload) {
    void searchSharedMedia(chat, threadId, type, nextOffsetId, true);
  }
}

async function searchMessagesByDate(chat: ApiChat, timestamp: number) {
  const messageId = await callApi('findFirstMessageIdAfterDate', {
    chat,
    timestamp,
  });

  if (!messageId) {
    return;
  }

  getActions().focusMessage({
    chatId: chat.id,
    messageId,
  });
}
