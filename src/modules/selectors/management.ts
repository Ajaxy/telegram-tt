import { GlobalState } from '../../global/types';

import { selectCurrentMessageList } from './messages';
import { selectChat } from './chats';
import { isChatGroup, isChatPrivate } from '../helpers';

export function selectManagement(global: GlobalState, chatId: number) {
  return global.management.byChatId[chatId];
}

export function selectCurrentManagement(global: GlobalState) {
  const { chatId, threadId } = selectCurrentMessageList(global) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  const currentManagement = global.management.byChatId[chatId];
  if (!currentManagement || !currentManagement.isActive) {
    return undefined;
  }

  return currentManagement;
}

export function selectCurrentManagementType(global: GlobalState) {
  const { chatId, threadId } = selectCurrentMessageList(global) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  if (isChatPrivate(chatId)) {
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
