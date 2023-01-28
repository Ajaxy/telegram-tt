import type { GlobalState, TabArgs } from '../types';
import { selectCurrentMessageList } from './messages';
import { buildChatThreadKey } from '../helpers';
import { selectTabState } from './tabs';
import { getCurrentTabId } from '../../util/establishMultitabRole';

export function selectCurrentTextSearch<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  const chatThreadKey = buildChatThreadKey(chatId, threadId);
  const currentSearch = selectTabState(global, tabId).localTextSearch.byChatThreadKey[chatThreadKey];
  if (!currentSearch || !currentSearch.isActive) {
    return undefined;
  }

  return currentSearch;
}

export function selectCurrentMediaSearch<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  const chatThreadKey = buildChatThreadKey(chatId, threadId);

  return selectTabState(global, tabId).localMediaSearch.byChatThreadKey[chatThreadKey];
}
