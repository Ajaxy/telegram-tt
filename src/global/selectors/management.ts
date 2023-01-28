import type { GlobalState, TabArgs } from '../types';

import { selectCurrentMessageList } from './messages';
import { selectChat } from './chats';
import { isChatGroup, isUserId } from '../helpers';
import { selectTabState } from './tabs';
import { getCurrentTabId } from '../../util/establishMultitabRole';

export function selectManagement<T extends GlobalState>(
  global: T, chatId: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabState(global, tabId).management.byChatId[chatId];
}

export function selectCurrentManagement<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  const currentManagement = selectTabState(global, tabId).management.byChatId[chatId];
  if (!currentManagement || !currentManagement.isActive) {
    return undefined;
  }

  return currentManagement;
}

export function selectCurrentManagementType<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  if (isUserId(chatId)) {
    return 'user';
  }

  const chat = selectChat(global, chatId);
  if (!chat) {
    return undefined;
  }

  if (isChatGroup(chat)) {
    return 'group';
  }

  return 'channel';
}
