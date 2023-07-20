import type { GlobalState, TabArgs } from '../types';

import { selectCurrentMessageList } from './messages';
import { selectChatFullInfo } from './chats';
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

  return currentChatId ? selectChatFullInfo(global, currentChatId)?.canViewStatistics : undefined;
}
