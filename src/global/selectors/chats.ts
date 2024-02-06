import type {
  ApiChat, ApiChatFullInfo, ApiChatType, ApiPeer,
} from '../../api/types';
import type { ChatListType, GlobalState, TabArgs } from '../types';
import { MAIN_THREAD_ID } from '../../api/types';

import {
  ALL_FOLDER_ID, ARCHIVED_FOLDER_ID, MEMBERS_LOAD_SLICE, SAVED_FOLDER_ID, SERVICE_NOTIFICATIONS_USER_ID,
} from '../../config';
import { getCurrentTabId } from '../../util/establishMultitabRole';
import { IS_TRANSLATION_SUPPORTED } from '../../util/windowEnvironment';
import {
  getHasAdminRight,
  getPrivateChatUserId,
  isChatChannel,
  isChatSuperGroup,
  isHistoryClearMessage,
  isUserBot,
  isUserId,
  isUserOnline,
} from '../helpers';
import { selectTabState } from './tabs';
import {
  selectBot, selectIsCurrentUserPremium, selectUser, selectUserFullInfo,
} from './users';

export function selectPeer<T extends GlobalState>(global: T, peerId: string): ApiPeer | undefined {
  return selectUser(global, peerId) || selectChat(global, peerId);
}

export function selectChat<T extends GlobalState>(global: T, chatId: string): ApiChat | undefined {
  return global.chats.byId[chatId];
}

export function selectChatFullInfo<T extends GlobalState>(global: T, chatId: string): ApiChatFullInfo | undefined {
  return global.chats.fullInfoById[chatId];
}

export function selectPeerFullInfo<T extends GlobalState>(global: T, peerId: string) {
  if (isUserId(peerId)) return selectUserFullInfo(global, peerId);
  return selectChatFullInfo(global, peerId);
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
  const fullInfo = selectChatFullInfo(global, chat.id);
  if (isUserId(chat.id) || isChatChannel(chat) || !fullInfo) {
    return undefined;
  }

  if (!fullInfo.members || fullInfo.members.length === MEMBERS_LOAD_SLICE) {
    return fullInfo.onlineCount;
  }

  return fullInfo.members.reduce((onlineCount, { userId }) => {
    if (
      !selectIsChatWithSelf(global, userId)
      && global.users.byId[userId]
      && isUserOnline(global.users.byId[userId], global.users.statusesById[userId])
    ) {
      return onlineCount + 1;
    }

    return onlineCount;
  }, 0);
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
  const bot = selectBot(global, chatId);
  if (!chat || !bot) {
    return false;
  }

  const lastMessage = selectChatLastMessage(global, chatId);
  if (lastMessage && isHistoryClearMessage(lastMessage)) {
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
  global: T, chatId: string, type?: ChatListType,
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
  const { active, archived, saved } = global.chats.orderedPinnedIds;

  if (folderId === ALL_FOLDER_ID) {
    return Boolean(active?.includes(chatId));
  }

  if (folderId === ARCHIVED_FOLDER_ID) {
    return Boolean(archived?.includes(chatId));
  }

  if (folderId === SAVED_FOLDER_ID) {
    return Boolean(saved?.includes(chatId));
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

  const id = selectChatFullInfo(global, chatId)?.sendAsId;
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

export function selectCanInviteToChat<T extends GlobalState>(global: T, chatId: string) {
  const chat = selectChat(global, chatId);
  if (!chat) return false;

  // https://github.com/TelegramMessenger/Telegram-iOS/blob/5126be83b3b9578fb014eb52ca553da9e7a8b83a/submodules/TelegramCore/Sources/TelegramEngine/Peers/Communities.swift#L6
  return !chat.migratedTo && Boolean(!isUserId(chatId) && ((isChatChannel(chat) || isChatSuperGroup(chat)) ? (
    chat.isCreator || getHasAdminRight(chat, 'inviteUsers')
    || (chat.usernames?.length && !chat.isJoinRequest)
  ) : (chat.isCreator || getHasAdminRight(chat, 'inviteUsers'))));
}

export function selectCanShareFolder<T extends GlobalState>(global: T, folderId: number) {
  const folder = selectChatFolder(global, folderId);
  if (!folder) return false;

  const {
    bots, groups, channels, contacts, nonContacts, includedChatIds, pinnedChatIds,
    excludeArchived, excludeMuted, excludeRead, excludedChatIds,
  } = folder;

  return !bots && !groups && !channels && !contacts && !nonContacts
    && !excludeArchived && !excludeMuted && !excludeRead && !excludedChatIds?.length
    && (pinnedChatIds?.length || includedChatIds.length)
    && folder.includedChatIds.concat(folder.pinnedChatIds || []).some((chatId) => {
      return selectCanInviteToChat(global, chatId);
    });
}

export function selectShouldDetectChatLanguage<T extends GlobalState>(
  global: T, chatId: string,
) {
  const chat = selectChat(global, chatId);
  if (!chat) return false;
  const { canTranslateChats } = global.settings.byKey;

  const isPremium = selectIsCurrentUserPremium(global);
  const isSavedMessages = selectIsChatWithSelf(global, chatId);

  return IS_TRANSLATION_SUPPORTED && canTranslateChats && isPremium && !isSavedMessages;
}

export function selectCanTranslateChat<T extends GlobalState>(
  global: T, chatId: string, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const chat = selectChat(global, chatId);
  if (!chat) return false;

  const requestedTranslation = selectRequestedChatTranslationLanguage(global, chatId, tabId);
  if (requestedTranslation) return true; // Prevent translation dropping on reevaluation

  const isLanguageDetectable = selectShouldDetectChatLanguage(global, chatId);
  const detectedLanguage = chat.detectedLanguage;

  const { doNotTranslate } = global.settings.byKey;

  return Boolean(isLanguageDetectable && detectedLanguage && !doNotTranslate.includes(detectedLanguage));
}

export function selectRequestedChatTranslationLanguage<T extends GlobalState>(
  global: T, chatId: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { requestedTranslations } = selectTabState(global, tabId);

  return requestedTranslations.byChatId[chatId]?.toLanguage;
}

export function selectSimilarChannelIds<T extends GlobalState>(
  global: T,
  chatId: string,
) {
  return global.chats.similarChannelsById[chatId];
}

export function selectChatLastMessageId<T extends GlobalState>(
  global: T, chatId: string, listType: 'all' | 'saved' = 'all',
) {
  return global.chats.lastMessageIds[listType]?.[chatId];
}

export function selectChatLastMessage<T extends GlobalState>(
  global: T, chatId: string, listType: 'all' | 'saved' = 'all',
) {
  const id = selectChatLastMessageId(global, chatId, listType);
  if (!id) return undefined;

  const realChatId = listType === 'saved' ? global.currentUserId! : chatId;
  return global.messages.byChatId[realChatId]?.byId[id];
}
