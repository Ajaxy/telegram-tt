import type { ActionReturnType, GlobalState, TabArgs } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { buildChatThreadKey, isSameReaction } from '../../helpers';
import { addActionHandler } from '../../index';
import {
  replaceLocalTextSearchResults,
  updateLocalMediaSearchType,
  updateLocalTextSearch,
  updateLocalTextSearchTag,
} from '../../reducers';
import { selectCurrentMessageList, selectTabState } from '../../selectors';

addActionHandler('openLocalTextSearch', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  return updateLocalTextSearch(global, chatId, threadId, '', tabId);
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

  global = updateLocalTextSearch(global, chatId, threadId, query, tabId);

  return global;
});

addActionHandler('setLocalTextSearchTag', (global, actions, payload): ActionReturnType => {
  const { tag, tabId = getCurrentTabId() } = payload!;

  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  const chatThreadKey = buildChatThreadKey(chatId, threadId);
  const { savedTag } = selectTabState(global, tabId).localTextSearch.byChatThreadKey[chatThreadKey] || {};

  if (!isSameReaction(tag, savedTag)) {
    global = replaceLocalTextSearchResults(global, chatId, threadId, MEMO_EMPTY_ARRAY, undefined, undefined, tabId);
  }

  global = updateLocalTextSearchTag(global, chatId, threadId, tag, tabId);

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

  global = updateLocalTextSearchTag(global, chatId, threadId, undefined, tabId);
  global = updateLocalTextSearch(global, chatId, threadId, undefined, tabId);
  global = replaceLocalTextSearchResults(global, chatId, threadId, undefined, undefined, undefined, tabId);
  return global;
}
