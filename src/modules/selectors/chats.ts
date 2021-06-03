import { ApiChat, MAIN_THREAD_ID } from '../../api/types';
import { GlobalState } from '../../global/types';

import {
  getPrivateChatUserId, isChatChannel, isChatPrivate, isHistoryClearMessage, isUserBot, isUserOnline, selectIsChatMuted,
} from '../helpers';
import { selectUser } from './users';
import { ALL_FOLDER_ID, ARCHIVED_FOLDER_ID, MEMBERS_LOAD_SLICE } from '../../config';
import { selectNotifyExceptions, selectNotifySettings } from './settings';

export function selectChat(global: GlobalState, chatId: number): ApiChat | undefined {
  return global.chats.byId[chatId];
}

export function selectChatUser(global: GlobalState, chat: ApiChat) {
  const userId = getPrivateChatUserId(chat);
  if (!userId) {
    return false;
  }

  return selectUser(global, userId);
}

export function selectIsChatWithSelf(global: GlobalState, chatId: number) {
  return chatId === global.currentUserId;
}

export function selectIsChatWithBot(global: GlobalState, chat: ApiChat) {
  const user = selectChatUser(global, chat);
  return user && isUserBot(user);
}

export function selectSupportChat(global: GlobalState) {
  return Object.values(global.chats.byId).find(({ isSupport }: ApiChat) => isSupport);
}

export function selectChatOnlineCount(global: GlobalState, chat: ApiChat) {
  if (isChatPrivate(chat.id) || isChatChannel(chat) || !chat.fullInfo) {
    return undefined;
  }

  if (!chat.fullInfo.members || chat.fullInfo.members.length === MEMBERS_LOAD_SLICE) {
    return chat.fullInfo.onlineCount;
  }

  return chat.fullInfo.members.reduce((onlineCount, { userId }) => {
    if (global.users.byId[userId] && isUserOnline(global.users.byId[userId]) && userId !== global.currentUserId) {
      return onlineCount + 1;
    }

    return onlineCount;
  }, 0);
}

export function selectChatBot(global: GlobalState, chatId: number) {
  const chat = selectChat(global, chatId);
  const userId = chat && getPrivateChatUserId(chat);
  const user = userId && selectUser(global, userId);
  if (!user || !isUserBot(user)) {
    return undefined;
  }

  return user;
}

export function selectIsChatBotNotStarted(global: GlobalState, chatId: number) {
  const chat = selectChat(global, chatId);
  const bot = selectChatBot(global, chatId);
  if (!chat || !bot) {
    return false;
  }

  if (chat.lastMessage && isHistoryClearMessage(chat.lastMessage)) {
    return true;
  }

  const messageInfo = global.messages.byChatId[chatId];
  if (!messageInfo) {
    return false;
  }

  const { listedIds } = messageInfo.threadsById[MAIN_THREAD_ID] || {};
  return listedIds && !listedIds.length;
}

export function selectAreActiveChatsLoaded(global: GlobalState): boolean {
  return Boolean(global.chats.listIds.active);
}

export function selectIsChatListed(global: GlobalState, chatId: number, type?: 'active' | 'archived'): boolean {
  const { listIds } = global.chats;
  if (type) {
    const targetList = listIds[type];
    return Boolean(targetList && targetList.includes(chatId));
  }

  return Object.values(listIds).some((list) => list && list.includes(chatId));
}

export function selectChatListType(global: GlobalState, chatId: number): 'active' | 'archived' | undefined {
  const chat = selectChat(global, chatId);
  if (!chat || !selectIsChatListed(global, chatId)) {
    return undefined;
  }

  return chat.folderId === ARCHIVED_FOLDER_ID ? 'archived' : 'active';
}

export function selectChatFolder(global: GlobalState, folderId: number) {
  return global.chatFolders.byId[folderId];
}

export function selectTotalChatCount(global: GlobalState, listType: 'active' | 'archived'): number {
  const { totalCount } = global.chats;
  const allChatsCount = totalCount.all;
  const archivedChatsCount = totalCount.archived || 0;

  if (listType === 'archived') {
    return archivedChatsCount;
  }

  return allChatsCount ? allChatsCount - archivedChatsCount : 0;
}

export function selectIsChatPinned(global: GlobalState, chatId: number, folderId = ALL_FOLDER_ID): boolean {
  const { active, archived } = global.chats.orderedPinnedIds;

  if (folderId === ALL_FOLDER_ID) {
    return !!active && active.includes(chatId);
  }

  if (folderId === ARCHIVED_FOLDER_ID) {
    return !!archived && archived.includes(chatId);
  }

  const { byId: chatFoldersById } = global.chatFolders;

  const { pinnedChatIds } = chatFoldersById[folderId] || {};
  return !!pinnedChatIds && pinnedChatIds.includes(chatId);
}

// Slow, not to be used in `withGlobal`
export function selectChatByUsername(global: GlobalState, username: string) {
  const usernameLowered = username.toLowerCase();
  return Object.values(global.chats.byId).find(
    (chat) => chat.username && chat.username.toLowerCase() === usernameLowered,
  );
}

export function selectCountNotMutedUnread(global: GlobalState) {
  const activeChatIds = global.chats.listIds.active;
  if (!activeChatIds) {
    return 0;
  }

  const chats = global.chats.byId;

  return activeChatIds.reduce((acc, chatId) => {
    const chat = chats[chatId];

    if (
      chat
      && chat.unreadCount
      && !selectIsChatMuted(chat, selectNotifySettings(global), selectNotifyExceptions(global))
    ) {
      return acc + chat.unreadCount;
    }

    return acc;
  }, 0);
}
