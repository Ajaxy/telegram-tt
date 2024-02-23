import type { ApiChat } from '../../../api/types';
import type { SharedMediaType, ThreadId } from '../../../types';
import type { ActionReturnType, GlobalState, TabArgs } from '../../types';

import { MESSAGE_SEARCH_SLICE, SHARED_MEDIA_SLICE } from '../../../config';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { buildCollectionByKey } from '../../../util/iteratees';
import { callApi } from '../../../api/gramjs';
import { getIsSavedDialog, isSameReaction } from '../../helpers';
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

addActionHandler('searchMediaMessagesLocal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId || !threadId) {
    return;
  }

  const isSavedDialog = getIsSavedDialog(chatId, threadId, global.currentUserId);
  const realChatId = isSavedDialog ? String(threadId) : chatId;

  const chat = selectChat(global, realChatId);
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

  void searchSharedMedia(global, chat, threadId, type, offsetId, undefined, isSavedDialog, tabId);
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

  const currentSearch = selectCurrentMediaSearch(global, tabId);
  if (!currentSearch) {
    return;
  }

  global = addChats(global, buildCollectionByKey(chats, 'id'));
  global = addUsers(global, buildCollectionByKey(users, 'id'));
  global = addChatMessagesById(global, resultChatId, byId);
  global = updateLocalMediaSearchResults(
    global, resultChatId, threadId, type, newFoundIds, totalCount, nextOffsetId, tabId,
  );
  setGlobal(global);

  if (!isBudgetPreload) {
    void searchSharedMedia(global, chat, threadId, type, nextOffsetId, true, isSavedDialog, tabId);
  }
}
