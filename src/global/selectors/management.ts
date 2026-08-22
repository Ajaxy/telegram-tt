import type { ApiChat } from '../../api/types';
import type { GlobalState, TabArgs } from '../types';

import { SERVICE_NOTIFICATIONS_USER_ID } from '../../config';
import { isUserId } from '../../util/entities/ids';
import { getCurrentTabId } from '../../util/establishMultitabRole';
import {
  getCanAddContact,
  getHasAdminRight,
  isAnonymousForwardsChat,
  isChatAdmin, isChatGroup, isDeletedUser, isSystemBot, isUserBot, isUserRightBanned,
} from '../helpers';
import { selectChat, selectIsChatRestricted, selectIsChatWithSelf } from './chats';
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
  const isRestricted = selectIsChatRestricted(global, chatId);
  if (!chat || isRestricted || chat.isMonoforum) return false;

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

export function selectCanManageAutoDelete<T extends GlobalState>(
  global: T,
  chatId: string,
) {
  const chat = selectChat(global, chatId);
  if (!chat || selectIsChatRestricted(global, chatId) || chat.isMonoforum) return false;

  if (
    selectIsChatWithSelf(global, chatId)
    || isSystemBot(chatId)
    || isAnonymousForwardsChat(chatId)
    || chatId === SERVICE_NOTIFICATIONS_USER_ID
  ) {
    return false;
  }

  if (isUserId(chatId)) {
    const user = selectUser(global, chatId);
    return Boolean(user && !user.isSupport && !isDeletedUser(user));
  }

  return getCanChangeChatInfo(chat);
}

function getCanChangeChatInfo(chat: ApiChat) {
  if (chat.isCreator) return true;
  if (chat.isForbidden || chat.isNotJoined) return false;
  if (chat.adminRights) return getHasAdminRight(chat, 'changeInfo');

  // Regular members can be granted the right only in groups
  return isChatGroup(chat) && !isUserRightBanned(chat, 'changeInfo');
}
