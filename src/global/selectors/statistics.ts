import { GlobalState } from '../types';

import { selectCurrentMessageList } from './messages';
import { selectChat } from './chats';

export function selectStatistics(global: GlobalState, chatId: string) {
  return global.statistics.byChatId[chatId];
}

export function selectIsStatisticsShown(global: GlobalState) {
  if (!global.isStatisticsShown) {
    return false;
  }

  const { chatId: currentChatId } = selectCurrentMessageList(global) || {};
  const chat = currentChatId ? selectChat(global, currentChatId) : undefined;

  return chat?.fullInfo?.canViewStatistics;
}
