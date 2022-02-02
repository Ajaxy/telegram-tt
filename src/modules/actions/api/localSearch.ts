import {
  addReducer, getDispatch, getGlobal, setGlobal,
} from '../../../lib/teact/teactn';

import { ApiChat, ApiUser, MAIN_THREAD_ID } from '../../../api/types';

import { MESSAGE_SEARCH_SLICE, SHARED_MEDIA_SLICE } from '../../../config';
import { callApi } from '../../../api/gramjs';
import {
  selectCurrentTextSearch,
  selectCurrentMediaSearchPeerId,
  selectCurrentMediaSearch, selectCurrentMessageList, selectChat, selectThreadInfo,
} from '../../selectors';
import { buildCollectionByKey } from '../../../util/iteratees';
import {
  addChatMessagesById,
  addUsers,
  updateLocalMediaSearchResults,
  updateLocalTextSearchResults,
} from '../../reducers';
import { SharedMediaType } from '../../../types';

addReducer('searchTextMessagesLocal', (global) => {
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

addReducer('searchMediaMessagesLocal', (global) => {
  const peerId = selectCurrentMediaSearchPeerId(global);
  const chatOrUser = peerId
    ? global.users.byId[peerId] || global.chats.byId[peerId]
    : undefined;
  const currentSearch = selectCurrentMediaSearch(global);

  if (!chatOrUser || !currentSearch) {
    return;
  }

  const { currentType: type, resultsByType } = currentSearch;
  const currentResults = type && resultsByType && resultsByType[type];
  const offsetId = currentResults?.nextOffsetId;

  if (!type) {
    return;
  }

  void searchSharedMedia(chatOrUser, type, offsetId);
});

addReducer('searchMessagesByDate', (global, actions, payload) => {
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
  chatOrUser: ApiChat,
  threadId: number,
  topMessageId?: number,
  query?: string,
  offsetId?: number,
) {
  if (!query) {
    return;
  }

  const result = await callApi('searchMessagesLocal', {
    chatOrUser,
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
    messages, users, totalCount, nextOffsetId,
  } = result;

  const byId = buildCollectionByKey(messages, 'id');
  const newFoundIds = Object.keys(byId).map(Number);

  let global = getGlobal();

  const currentSearch = selectCurrentTextSearch(global);
  if (!currentSearch || query !== currentSearch.query) {
    return;
  }

  global = addChatMessagesById(global, chatOrUser.id, byId);
  global = addUsers(global, buildCollectionByKey(users, 'id'));
  global = updateLocalTextSearchResults(global, chatOrUser.id, threadId, newFoundIds, totalCount, nextOffsetId);
  setGlobal(global);
}

async function searchSharedMedia(
  chatOrUser: ApiChat | ApiUser,
  type: SharedMediaType,
  offsetId?: number,
  isBudgetPreload = false,
) {
  const result = await callApi('searchMessagesLocal', {
    chatOrUser,
    type,
    limit: SHARED_MEDIA_SLICE * 2,
    offsetId,
  });

  if (!result) {
    return;
  }

  const {
    messages, users, totalCount, nextOffsetId,
  } = result;

  const byId = buildCollectionByKey(messages, 'id');
  const newFoundIds = Object.keys(byId).map(Number);

  let global = getGlobal();

  const currentSearch = selectCurrentMediaSearch(global);
  if (!currentSearch) {
    return;
  }

  global = addChatMessagesById(global, chatOrUser.id, byId);
  global = addUsers(global, buildCollectionByKey(users, 'id'));
  global = updateLocalMediaSearchResults(global, chatOrUser.id, type, newFoundIds, totalCount, nextOffsetId);
  setGlobal(global);

  if (!isBudgetPreload) {
    searchSharedMedia(chatOrUser, type, nextOffsetId, true);
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

  getDispatch().focusMessage({
    chatId: chat.id,
    messageId,
  });
}
