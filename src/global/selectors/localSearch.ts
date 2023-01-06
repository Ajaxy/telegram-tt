import type { GlobalState } from '../types';
import { selectCurrentMessageList } from './messages';
import { buildChatThreadKey } from '../helpers';

export function selectCurrentTextSearch(global: GlobalState) {
  const { chatId, threadId } = selectCurrentMessageList(global) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  const chatThreadKey = buildChatThreadKey(chatId, threadId);
  const currentSearch = global.localTextSearch.byChatThreadKey[chatThreadKey];
  if (!currentSearch || !currentSearch.isActive) {
    return undefined;
  }

  return currentSearch;
}

export function selectCurrentMediaSearch(global: GlobalState) {
  const { chatId, threadId } = selectCurrentMessageList(global) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  const chatThreadKey = buildChatThreadKey(chatId, threadId);

  return global.localMediaSearch.byChatThreadKey[chatThreadKey];
}
