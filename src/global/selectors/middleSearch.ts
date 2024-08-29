import type { ThreadId } from '../../types';
import type { GlobalState, TabArgs } from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import { buildChatThreadKey } from '../helpers/middleSearch';
import { selectCurrentMessageList } from './messages';
import { selectTabState } from './tabs';

export function selectCurrentMiddleSearch<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  const chatThreadKey = buildChatThreadKey(chatId, threadId);

  return selectTabState(global, tabId).middleSearch.byChatThreadKey[chatThreadKey];
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
