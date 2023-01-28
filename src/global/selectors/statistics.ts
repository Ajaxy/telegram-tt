import type { GlobalState, TabArgs } from '../types';

import { selectCurrentMessageList } from './messages';
import { selectChat } from './chats';
import { selectTabState } from './tabs';
import { getCurrentTabId } from '../../util/establishMultitabRole';

export function selectStatistics<T extends GlobalState>(
  global: T, chatId: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabState(global, tabId).statistics.byChatId[chatId];
}

export function selectIsStatisticsShown<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  if (!selectTabState(global, tabId).isStatisticsShown) {
    return false;
  }

  const { chatId: currentChatId } = selectCurrentMessageList(global, tabId) || {};
  const chat = currentChatId ? selectChat(global, currentChatId) : undefined;

  return chat?.fullInfo?.canViewStatistics;
}

export function selectIsMessageStatisticsShown<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  if (!selectTabState(global, tabId).isStatisticsShown) {
    return false;
  }

  return Boolean(selectTabState(global, tabId).statistics.currentMessageId);
}
