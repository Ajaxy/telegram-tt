import type { GlobalState, TabArgs } from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import {
  getCanAddContact,
  isAnonymousForwardsChat,
  isChatAdmin, isChatGroup, isUserBot, isUserId,
} from '../helpers';
import { selectChat, selectIsChatWithSelf } from './chats';
import { selectCurrentMessageList } from './messages';
import { selectTabState } from './tabs';
import { selectBot, selectUser } from './users';

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
  if (!currentManagement?.isActive) {
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

  const chatBot = selectBot(global, chatId);
  if (chatBot) {
    return 'bot';
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

export function selectCanManage<T extends GlobalState>(
  global: T,
  chatId: string,
) {
  const chat = selectChat(global, chatId);
  if (!chat || chat.isRestricted) return false;

  const isPrivate = isUserId(chat.id);
  const user = isPrivate ? selectUser(global, chatId) : undefined;
  const canAddContact = user && getCanAddContact(user);

  const isBot = user && isUserBot(user);
  return Boolean(
    !canAddContact
    && chat
    && !selectIsChatWithSelf(global, chat.id)
    && !isAnonymousForwardsChat(chat.id)
    // chat.isCreator is for Basic Groups
    && (isUserId(chat.id) || ((isChatAdmin(chat) || chat.isCreator) && !chat.isNotJoined))
    && !isBot,
  );
}
