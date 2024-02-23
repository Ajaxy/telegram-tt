import type { GlobalState, TabArgs } from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import { buildChatThreadKey } from '../helpers';
import { selectCurrentMessageList } from './messages';
import { selectTabState } from './tabs';

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
  if (!currentSearch || currentSearch.query === undefined) {
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
