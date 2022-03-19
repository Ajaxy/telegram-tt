import { addActionHandler } from '../../index';

import {
  updateLocalTextSearch,
  replaceLocalTextSearchResults,
  updateLocalMediaSearchType,
} from '../../reducers';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { selectCurrentMessageList } from '../../selectors';
import { buildChatThreadKey } from '../../helpers';
import { GlobalState } from '../../types';

addActionHandler('openLocalTextSearch', (global) => {
  const { chatId, threadId } = selectCurrentMessageList(global) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  return updateLocalTextSearch(global, chatId, threadId, true);
});

addActionHandler('closeLocalTextSearch', closeLocalTextSearch);

addActionHandler('setLocalTextSearchQuery', (global, actions, payload) => {
  const { chatId, threadId } = selectCurrentMessageList(global) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  const { query } = payload!;
  const chatThreadKey = buildChatThreadKey(chatId, threadId);
  const { query: currentQuery } = global.localTextSearch.byChatThreadKey[chatThreadKey] || {};

  if (query !== currentQuery) {
    global = replaceLocalTextSearchResults(global, chatId, threadId, MEMO_EMPTY_ARRAY);
  }

  global = updateLocalTextSearch(global, chatId, threadId, true, query);

  return global;
});

addActionHandler('setLocalMediaSearchType', (global, actions, payload) => {
  const { chatId } = selectCurrentMessageList(global) || {};
  if (!chatId) {
    return undefined;
  }

  const { mediaType } = payload!;
  return updateLocalMediaSearchType(global, chatId, mediaType);
});

export function closeLocalTextSearch(global: GlobalState): GlobalState {
  const { chatId, threadId } = selectCurrentMessageList(global) || {};
  if (!chatId || !threadId) {
    return global;
  }

  global = updateLocalTextSearch(global, chatId, threadId, false);
  global = replaceLocalTextSearchResults(global, chatId, threadId, undefined);
  return global;
}
