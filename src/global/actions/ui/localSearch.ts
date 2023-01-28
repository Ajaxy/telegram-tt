import { addActionHandler } from '../../index';

import {
  updateLocalTextSearch,
  replaceLocalTextSearchResults,
  updateLocalMediaSearchType,
} from '../../reducers';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { selectCurrentMessageList, selectTabState } from '../../selectors';
import { buildChatThreadKey } from '../../helpers';
import type { ActionReturnType, GlobalState, TabArgs } from '../../types';
import { getCurrentTabId } from '../../../util/establishMultitabRole';

addActionHandler('openLocalTextSearch', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  return updateLocalTextSearch(global, chatId, threadId, true, undefined, tabId);
});

addActionHandler('closeLocalTextSearch', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return closeLocalTextSearch(global, tabId);
});

addActionHandler('setLocalTextSearchQuery', (global, actions, payload): ActionReturnType => {
  const { query, tabId = getCurrentTabId() } = payload!;

  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  const chatThreadKey = buildChatThreadKey(chatId, threadId);
  const { query: currentQuery } = selectTabState(global, tabId).localTextSearch.byChatThreadKey[chatThreadKey] || {};

  if (query !== currentQuery) {
    global = replaceLocalTextSearchResults(global, chatId, threadId, MEMO_EMPTY_ARRAY, undefined, undefined, tabId);
  }

  global = updateLocalTextSearch(global, chatId, threadId, true, query, tabId);

  return global;
});

addActionHandler('setLocalMediaSearchType', (global, actions, payload): ActionReturnType => {
  const { mediaType, tabId = getCurrentTabId() } = payload;
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  return updateLocalMediaSearchType(global, chatId, threadId, mediaType, tabId);
});

export function closeLocalTextSearch<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId || !threadId) {
    return global;
  }

  global = updateLocalTextSearch(global, chatId, threadId, false, undefined, tabId);
  global = replaceLocalTextSearchResults(global, chatId, threadId, undefined, undefined, undefined, tabId);
  return global;
}
