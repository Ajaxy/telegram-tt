import type { ThreadId } from '../../types';
import type { GlobalState, TabArgs } from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import { buildChatThreadKey } from '../helpers/localSearch';
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

export function selectCurrentSharedMediaSearch<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  const chatThreadKey = buildChatThreadKey(chatId, threadId);

  return selectTabState(global, tabId).sharedMediaSearch.byChatThreadKey[chatThreadKey];
}

export function selectCurrentChatMediaSearch<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  const chatThreadKey = buildChatThreadKey(chatId, threadId);

  return selectTabState(global, tabId).chatMediaSearch.byChatThreadKey[chatThreadKey];
}

export function selectChatMediaSearch<T extends GlobalState>(
  global: T, chatId?: string, threadId?: ThreadId,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  if (!chatId || !threadId) {
    return undefined;
  }

  const chatThreadKey = buildChatThreadKey(chatId, threadId);

  return selectTabState(global, tabId).chatMediaSearch.byChatThreadKey[chatThreadKey];
}
