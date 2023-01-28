import type { ApiChatType, ApiChat } from '../../api/types';
import { MAIN_THREAD_ID } from '../../api/types';
import type { GlobalState, TabArgs } from '../types';

import {
  getPrivateChatUserId, isChatChannel, isUserId, isHistoryClearMessage, isUserBot, isUserOnline,
} from '../helpers';
import { selectBot, selectUser } from './users';
import {
  ALL_FOLDER_ID, ARCHIVED_FOLDER_ID, MEMBERS_LOAD_SLICE, SERVICE_NOTIFICATIONS_USER_ID,
} from '../../config';
import { selectTabState } from './tabs';
import { getCurrentTabId } from '../../util/establishMultitabRole';

export function selectChat<T extends GlobalState>(global: T, chatId: string): ApiChat | undefined {
  return global.chats.byId[chatId];
}

export function selectChatUser<T extends GlobalState>(global: T, chat: ApiChat) {
  const userId = getPrivateChatUserId(chat);
  if (!userId) {
    return false;
  }

  return selectUser(global, userId);
}

export function selectIsChatWithSelf<T extends GlobalState>(global: T, chatId: string) {
  return chatId === global.currentUserId;
}

export function selectIsChatWithBot<T extends GlobalState>(global: T, chat: ApiChat) {
  const user = selectChatUser(global, chat);
  return user && isUserBot(user);
}

export function selectSupportChat<T extends GlobalState>(global: T) {
  return Object.values(global.chats.byId).find(({ isSupport }: ApiChat) => isSupport);
}

export function selectChatOnlineCount<T extends GlobalState>(global: T, chat: ApiChat) {
  if (isUserId(chat.id) || isChatChannel(chat) || !chat.fullInfo) {
    return undefined;
  }

  if (!chat.fullInfo.members || chat.fullInfo.members.length === MEMBERS_LOAD_SLICE) {
    return chat.fullInfo.onlineCount;
  }

  return chat.fullInfo.members.reduce((onlineCount, { userId }) => {
    if (
      userId !== global.currentUserId
      && global.users.byId[userId]
      && isUserOnline(global.users.byId[userId], global.users.statusesById[userId])
    ) {
      return onlineCount + 1;
    }

    return onlineCount;
  }, 0);
}

export function selectChatBot<T extends GlobalState>(global: T, chatId: string) {
  const chat = selectChat(global, chatId);
  const userId = chat && getPrivateChatUserId(chat);
  const user = userId && selectUser(global, userId);
  if (!user || !isUserBot(user)) {
    return undefined;
  }

  return user;
}

export function selectIsTrustedBot<T extends GlobalState>(global: T, botId: string) {
  const bot = selectUser(global, botId);
  return bot && (bot.isVerified || global.trustedBotIds.includes(botId));
}

export function selectChatType<T extends GlobalState>(global: T, chatId: string) : ApiChatType | undefined {
  const chat = selectChat(global, chatId);
  if (!chat) return undefined;

  const bot = selectBot(global, chatId);
  if (bot) {
    return 'bots';
  }

  const user = selectChatUser(global, chat);
  if (user) {
    return 'users';
  }

  if (isChatChannel(chat)) {
    return 'channels';
  }

  return 'chats';
}

export function selectIsChatBotNotStarted<T extends GlobalState>(global: T, chatId: string) {
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

export function selectAreActiveChatsLoaded<T extends GlobalState>(global: T): boolean {
  return Boolean(global.chats.listIds.active);
}

export function selectIsChatListed<T extends GlobalState>(
  global: T, chatId: string, type?: 'active' | 'archived',
): boolean {
  const { listIds } = global.chats;
  if (type) {
    const targetList = listIds[type];
    return Boolean(targetList && targetList.includes(chatId));
  }

  return Object.values(listIds).some((list) => list && list.includes(chatId));
}

export function selectChatListType<T extends GlobalState>(
  global: T, chatId: string,
): 'active' | 'archived' | undefined {
  const chat = selectChat(global, chatId);
  if (!chat || !selectIsChatListed(global, chatId)) {
    return undefined;
  }

  return chat.folderId === ARCHIVED_FOLDER_ID ? 'archived' : 'active';
}

export function selectChatFolder<T extends GlobalState>(global: T, folderId: number) {
  return global.chatFolders.byId[folderId];
}

export function selectTotalChatCount<T extends GlobalState>(global: T, listType: 'active' | 'archived'): number {
  const { totalCount } = global.chats;
  const allChatsCount = totalCount.all;
  const archivedChatsCount = totalCount.archived || 0;

  if (listType === 'archived') {
    return archivedChatsCount;
  }

  return allChatsCount ? allChatsCount - archivedChatsCount : 0;
}

export function selectIsChatPinned<T extends GlobalState>(
  global: T, chatId: string, folderId = ALL_FOLDER_ID,
): boolean {
  const { active, archived } = global.chats.orderedPinnedIds;

  if (folderId === ALL_FOLDER_ID) {
    return Boolean(active?.includes(chatId));
  }

  if (folderId === ARCHIVED_FOLDER_ID) {
    return Boolean(archived?.includes(chatId));
  }

  const { byId: chatFoldersById } = global.chatFolders;

  const { pinnedChatIds } = chatFoldersById[folderId] || {};
  return Boolean(pinnedChatIds?.includes(chatId));
}

// Slow, not to be used in `withGlobal`
export function selectChatByUsername<T extends GlobalState>(global: T, username: string) {
  const usernameLowered = username.toLowerCase();
  return Object.values(global.chats.byId).find(
    (chat) => chat.usernames?.some((c) => c.username.toLowerCase() === usernameLowered),
  );
}

export function selectIsServiceChatReady<T extends GlobalState>(global: T) {
  return Boolean(selectChat(global, SERVICE_NOTIFICATIONS_USER_ID));
}

export function selectSendAs<T extends GlobalState>(global: T, chatId: string) {
  const chat = selectChat(global, chatId);
  if (!chat) return undefined;

  const id = chat?.fullInfo?.sendAsId;
  if (!id) return undefined;

  return selectUser(global, id) || selectChat(global, id);
}

export function selectRequestedDraftText<T extends GlobalState>(
  global: T, chatId: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { requestedDraft } = selectTabState(global, tabId);
  if (requestedDraft?.chatId === chatId && !requestedDraft.files?.length) {
    return requestedDraft.text;
  }
  return undefined;
}

export function selectRequestedDraftFiles<T extends GlobalState>(
  global: T, chatId: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { requestedDraft } = selectTabState(global, tabId);
  if (requestedDraft?.chatId === chatId) {
    return requestedDraft.files;
  }
  return undefined;
}

export function filterChatIdsByType<T extends GlobalState>(
  global: T, chatIds: string[], filter: readonly ApiChatType[],
) {
  return chatIds.filter((id) => {
    const type = selectChatType(global, id);
    if (!type) {
      return false;
    }
    return filter.includes(type);
  });
}
