import {
  ApiChat,
  ApiUser,
  ApiChatBannedRights,
  ApiChatAdminRights,
  ApiChatFolder,
  MAIN_THREAD_ID,
} from '../../api/types';

import { NotifyException, NotifySettings } from '../../types';
import { LangFn } from '../../hooks/useLang';

import { ARCHIVED_FOLDER_ID, REPLIES_USER_ID } from '../../config';
import { orderBy } from '../../util/iteratees';
import { getUserFirstOrLastName } from './users';
import { formatDateToString, formatTime } from '../../util/dateFormat';

const FOREVER_BANNED_DATE = Date.now() / 1000 + 31622400; // 366 days

const VERIFIED_PRIORITY_BASE = 3e9;
const PINNED_PRIORITY_BASE = 3e8;

export function isUserId(entityId: string) {
  // Workaround for old-fashioned IDs stored locally
  if (typeof entityId === 'number') {
    return entityId > 0;
  }

  return !entityId.startsWith('-');
}

export function isChatGroup(chat: ApiChat) {
  return isChatBasicGroup(chat) || isChatSuperGroup(chat);
}

export function isChatBasicGroup(chat: ApiChat) {
  return chat.type === 'chatTypeBasicGroup';
}

export function isChatSuperGroup(chat: ApiChat) {
  return chat.type === 'chatTypeSuperGroup';
}

export function isChatChannel(chat: ApiChat) {
  return chat.type === 'chatTypeChannel';
}

export function isCommonBoxChat(chat: ApiChat) {
  return chat.type === 'chatTypePrivate' || chat.type === 'chatTypeBasicGroup';
}

export function isChatWithRepliesBot(chatId: string) {
  return chatId === REPLIES_USER_ID;
}

export function getChatTypeString(chat: ApiChat) {
  switch (chat.type) {
    case 'chatTypePrivate':
      return 'PrivateChat';
    case 'chatTypeBasicGroup':
    case 'chatTypeSuperGroup':
      return 'AccDescrGroup';
    case 'chatTypeChannel':
      return 'AccDescrChannel';
    default:
      return 'Chat';
  }
}

export function getPrivateChatUserId(chat: ApiChat) {
  if (chat.type !== 'chatTypePrivate' && chat.type !== 'chatTypeSecret') {
    return undefined;
  }
  return chat.id;
}

// TODO Get rid of `user`
export function getChatTitle(lang: LangFn, chat: ApiChat, user?: ApiUser, isSelf = false) {
  if (isSelf || (user && chat.id === user.id && user.isSelf)) {
    return lang('SavedMessages');
  }
  return chat.title || lang('HiddenName');
}

export function getChatDescription(chat: ApiChat) {
  if (!chat.fullInfo) {
    return undefined;
  }
  return chat.fullInfo.about;
}

export function getChatLink(chat: ApiChat) {
  const { username } = chat;
  if (username) {
    return `https://t.me/${username}`;
  }

  const { inviteLink } = chat.fullInfo || {};

  return inviteLink;
}

export function getChatAvatarHash(
  owner: ApiChat | ApiUser,
  size: 'normal' | 'big' = 'normal',
) {
  if (!owner.avatarHash) {
    return undefined;
  }

  switch (size) {
    case 'big':
      return `profile${owner.id}?${owner.avatarHash}`;
    default:
      return `avatar${owner.id}?${owner.avatarHash}`;
  }
}

export function isChatSummaryOnly(chat: ApiChat) {
  return !chat.lastMessage;
}

export function isChatAdmin(chat: ApiChat) {
  return Boolean(chat.adminRights);
}

export function getHasAdminRight(chat: ApiChat, key: keyof ApiChatAdminRights) {
  return chat.adminRights ? chat.adminRights[key] : false;
}

export function isUserRightBanned(chat: ApiChat, key: keyof ApiChatBannedRights) {
  return Boolean(
    (chat.currentUserBannedRights?.[key])
    || (chat.defaultBannedRights?.[key]),
  );
}

export function getCanPostInChat(chat: ApiChat, threadId: number) {
  if (threadId !== MAIN_THREAD_ID) {
    return true;
  }

  if (chat.isRestricted || chat.migratedTo || chat.isNotJoined || isChatWithRepliesBot(chat.id)) {
    return false;
  }

  if (chat.isCreator) {
    return true;
  }

  if (isUserId(chat.id)) {
    return true;
  }

  if (isChatChannel(chat)) {
    return getHasAdminRight(chat, 'postMessages');
  }

  return isChatAdmin(chat) || !isUserRightBanned(chat, 'sendMessages');
}

export interface IAllowedAttachmentOptions {
  canAttachMedia: boolean;
  canAttachPolls: boolean;
  canSendStickers: boolean;
  canSendGifs: boolean;
  canAttachEmbedLinks: boolean;
}

export function getAllowedAttachmentOptions(chat?: ApiChat, isChatWithBot = false): IAllowedAttachmentOptions {
  if (!chat) {
    return {
      canAttachMedia: false,
      canAttachPolls: false,
      canSendStickers: false,
      canSendGifs: false,
      canAttachEmbedLinks: false,
    };
  }

  const isAdmin = isChatAdmin(chat);

  return {
    canAttachMedia: isAdmin || !isUserRightBanned(chat, 'sendMedia'),
    canAttachPolls: (isAdmin || !isUserRightBanned(chat, 'sendPolls')) && (!isUserId(chat.id) || isChatWithBot),
    canSendStickers: isAdmin || !isUserRightBanned(chat, 'sendStickers'),
    canSendGifs: isAdmin || !isUserRightBanned(chat, 'sendGifs'),
    canAttachEmbedLinks: isAdmin || !isUserRightBanned(chat, 'embedLinks'),
  };
}

export function getMessageSendingRestrictionReason(
  lang: LangFn,
  currentUserBannedRights?: ApiChatBannedRights,
  defaultBannedRights?: ApiChatBannedRights,
) {
  if (currentUserBannedRights?.sendMessages) {
    const { untilDate } = currentUserBannedRights;
    return untilDate && untilDate < FOREVER_BANNED_DATE
      ? lang(
        'Channel.Persmission.Denied.SendMessages.Until',
        lang(
          'formatDateAtTime',
          [formatDateToString(new Date(untilDate * 1000), lang.code), formatTime(untilDate * 1000, lang)],
        ),
      )
      : lang('Channel.Persmission.Denied.SendMessages.Forever');
  }

  if (defaultBannedRights?.sendMessages) {
    return lang('Channel.Persmission.Denied.SendMessages.DefaultRestrictedText');
  }

  return undefined;
}

export function getChatSlowModeOptions(chat?: ApiChat) {
  if (!chat || !chat.fullInfo) {
    return undefined;
  }

  return chat.fullInfo.slowMode;
}

export function getChatOrder(chat: ApiChat) {
  return Math.max(chat.joinDate || 0, chat.draftDate || 0, chat.lastMessage?.date || 0);
}

export function isChatArchived(chat: ApiChat) {
  return chat.folderId === ARCHIVED_FOLDER_ID;
}

export function selectIsChatMuted(
  chat: ApiChat, notifySettings: NotifySettings, notifyExceptions: Record<string, NotifyException> = {},
) {
  // If this chat is in exceptions they take precedence
  if (notifyExceptions[chat.id] && notifyExceptions[chat.id].isMuted !== undefined) {
    return notifyExceptions[chat.id].isMuted;
  }

  return (
    chat.isMuted
    || (isUserId(chat.id) && !notifySettings.hasPrivateChatsNotifications)
    || (isChatChannel(chat) && !notifySettings.hasBroadcastNotifications)
    || (isChatGroup(chat) && !notifySettings.hasGroupNotifications)
  );
}

export function selectShouldShowMessagePreview(
  chat: ApiChat, notifySettings: NotifySettings, notifyExceptions: Record<string, NotifyException> = {},
) {
  const {
    hasPrivateChatsMessagePreview = true,
    hasBroadcastMessagePreview = true,
    hasGroupMessagePreview = true,
  } = notifySettings;
  // If this chat is in exceptions they take precedence
  if (notifyExceptions[chat.id] && notifyExceptions[chat.id].shouldShowPreviews !== undefined) {
    return notifyExceptions[chat.id].shouldShowPreviews;
  }

  return (isUserId(chat.id) && hasPrivateChatsMessagePreview)
    || (isChatChannel(chat) && hasBroadcastMessagePreview)
    || (isChatGroup(chat) && hasGroupMessagePreview);
}

export function getCanDeleteChat(chat: ApiChat) {
  return isChatBasicGroup(chat) || ((isChatSuperGroup(chat) || isChatChannel(chat)) && chat.isCreator);
}

export function prepareFolderListIds(
  chatsById: Record<string, ApiChat>,
  usersById: Record<string, ApiUser>,
  folder: ApiChatFolder,
  notifySettings: NotifySettings,
  notifyExceptions?: Record<number, NotifyException>,
  chatIdsCache?: string[],
) {
  const excludedChatIds = folder.excludedChatIds ? new Set(folder.excludedChatIds) : undefined;
  const includedChatIds = folder.excludedChatIds ? new Set(folder.includedChatIds) : undefined;
  const pinnedChatIds = folder.excludedChatIds ? new Set(folder.pinnedChatIds) : undefined;
  const listIds = (chatIdsCache || Object.keys(chatsById))
    .filter((id) => {
      return filterChatFolder(
        chatsById[id],
        folder,
        usersById,
        notifySettings,
        notifyExceptions,
        excludedChatIds,
        includedChatIds,
        pinnedChatIds,
      );
    });

  return [listIds, folder.pinnedChatIds] as const;
}

function filterChatFolder(
  chat: ApiChat,
  folder: ApiChatFolder,
  usersById: Record<string, ApiUser>,
  notifySettings: NotifySettings,
  notifyExceptions?: Record<number, NotifyException>,
  excludedChatIds?: Set<string>,
  includedChatIds?: Set<string>,
  pinnedChatIds?: Set<string>,
) {
  if (!chat.isListed) {
    return false;
  }

  if (excludedChatIds && excludedChatIds.has(chat.id)) {
    return false;
  }

  if (includedChatIds && includedChatIds.has(chat.id)) {
    return true;
  }

  if (pinnedChatIds && pinnedChatIds.has(chat.id)) {
    return true;
  }

  if (isChatArchived(chat) && folder.excludeArchived) {
    return false;
  }

  if (folder.excludeMuted && !chat.unreadMentionsCount && selectIsChatMuted(chat, notifySettings, notifyExceptions)) {
    return false;
  }

  if (!chat.unreadCount && !chat.unreadMentionsCount && !chat.hasUnreadMark && folder.excludeRead) {
    return false;
  }

  if (isUserId(chat.id)) {
    const privateChatUser = usersById[chat.id];

    const isChatWithBot = privateChatUser && privateChatUser.type === 'userTypeBot';
    if (isChatWithBot) {
      if (folder.bots) {
        return true;
      }
    } else {
      if (folder.contacts && privateChatUser && privateChatUser.isContact) {
        return true;
      }

      if (folder.nonContacts && privateChatUser && !privateChatUser.isContact) {
        return true;
      }
    }
  } else if (isChatGroup(chat)) {
    return !!folder.groups;
  } else if (isChatChannel(chat)) {
    return !!folder.channels;
  }

  return false;
}

export function prepareChatList(
  chatsById: Record<string, ApiChat>,
  listIds: string[],
  orderedPinnedIds?: string[],
  folderType: 'all' | 'archived' | 'folder' = 'all',
) {
  const listIdsSet = new Set(listIds);
  const orderedPinnedIdsSet = orderedPinnedIds ? new Set(orderedPinnedIds) : undefined;

  const pinnedChats = orderedPinnedIds?.reduce((acc, id) => {
    const chat = chatsById[id];

    if (chat && listIdsSet.has(chat.id) && chatFilter(chat, folderType)) {
      acc.push(chat);
    }

    return acc;
  }, [] as ApiChat[]) || [];

  const otherChats = listIds.reduce((acc, id) => {
    const chat = chatsById[id];

    if (chat && (!orderedPinnedIdsSet || !orderedPinnedIdsSet.has(chat.id)) && chatFilter(chat, folderType)) {
      acc.push(chat);
    }

    return acc;
  }, [] as ApiChat[]);
  const otherChatsOrdered = orderBy(otherChats, getChatOrder, 'desc');

  return {
    pinnedChats,
    otherChats: otherChatsOrdered,
  };
}

function chatFilter(chat: ApiChat, folderType: 'all' | 'archived' | 'folder') {
  if (!chat.lastMessage || chat.migratedTo) {
    return false;
  }

  switch (folderType) {
    case 'all':
      if (isChatArchived(chat)) {
        return false;
      }
      break;
    case 'archived':
      if (!isChatArchived(chat)) {
        return false;
      }
      break;
  }

  return !chat.isRestricted && !chat.isNotJoined;
}

export function reduceChatList(
  chatArrays: { pinnedChats: ApiChat[]; otherChats: ApiChat[] },
  filteredIds: string[],
) {
  const filteredIdsSet = new Set(filteredIds);

  return {
    pinnedChats: chatArrays.pinnedChats.filter(({ id }) => filteredIdsSet.has(id)),
    otherChats: chatArrays.otherChats.filter(({ id }) => filteredIdsSet.has(id)),
  };
}

export function getFolderUnreadDialogs(
  chatsById: Record<string, ApiChat>,
  usersById: Record<string, ApiUser>,
  folder: ApiChatFolder,
  chatIdsCache: string[],
  notifySettings: NotifySettings,
  notifyExceptions?: Record<number, NotifyException>,
) {
  const [listIds] = prepareFolderListIds(chatsById, usersById, folder, notifySettings, notifyExceptions, chatIdsCache);

  const listedChats = listIds
    .map((id) => chatsById[id])
    .filter((chat) => (chat?.lastMessage && !chat.isRestricted && !chat.isNotJoined));

  const unreadDialogsCount = listedChats
    .reduce((total, chat) => (chat.unreadCount || chat.hasUnreadMark ? total + 1 : total), 0);

  const hasActiveDialogs = listedChats.some((chat) => (
    chat.unreadMentionsCount
    || (!selectIsChatMuted(chat, notifySettings, notifyExceptions) && (chat.unreadCount || chat.hasUnreadMark))
  ));

  return {
    unreadDialogsCount,
    hasActiveDialogs,
  };
}

export function getFolderDescriptionText(
  lang: LangFn,
  chatsById: Record<string, ApiChat>,
  usersById: Record<string, ApiUser>,
  folder: ApiChatFolder,
  chatIdsCache: string[],
  notifySettings: NotifySettings,
  notifyExceptions?: Record<number, NotifyException>,
) {
  const {
    id, title, emoticon, description, pinnedChatIds,
    excludedChatIds, includedChatIds,
    excludeArchived, excludeMuted, excludeRead,
    ...filters
  } = folder;

  // If folder has multiple additive filters or uses include/exclude lists,
  // we display folder chats count
  if (
    Object.values(filters).filter(Boolean).length > 1
    || (excludedChatIds?.length)
    || (includedChatIds?.length)
  ) {
    const length = getFolderChatsCount(chatsById, usersById, folder, chatIdsCache, notifySettings, notifyExceptions);
    return lang('Chats', length);
  }

  // Otherwise, we return a short description of a single filter
  if (filters.bots) {
    return lang('FilterBots');
  } else if (filters.groups) {
    return lang('FilterGroups');
  } else if (filters.channels) {
    return lang('FilterChannels');
  } else if (filters.contacts) {
    return lang('FilterContacts');
  } else if (filters.nonContacts) {
    return lang('FilterNonContacts');
  } else {
    return undefined;
  }
}

function getFolderChatsCount(
  chatsById: Record<string, ApiChat>,
  usersById: Record<string, ApiUser>,
  folder: ApiChatFolder,
  chatIdsCache: string[],
  notifySettings: NotifySettings,
  notifyExceptions?: Record<string, NotifyException>,
) {
  const [listIds, pinnedIds] = prepareFolderListIds(
    chatsById, usersById, folder, notifySettings, notifyExceptions, chatIdsCache,
  );
  const { pinnedChats, otherChats } = prepareChatList(chatsById, listIds, pinnedIds, 'folder');
  return pinnedChats.length + otherChats.length;
}

export function getMessageSenderName(lang: LangFn, chatId: string, sender?: ApiUser) {
  if (!sender || isUserId(chatId)) {
    return undefined;
  }

  if (sender.isSelf) {
    return lang('FromYou');
  }

  return getUserFirstOrLastName(sender);
}

export function sortChatIds(
  chatIds: string[],
  chatsById: Record<string, ApiChat>,
  shouldPrioritizeVerified = false,
  priorityIds?: string[],
) {
  return orderBy(chatIds, (id) => {
    const chat = chatsById[id];
    if (!chat) {
      return 0;
    }

    let priority = 0;

    if (chat.lastMessage) {
      priority += chat.lastMessage.date;
    }

    if (shouldPrioritizeVerified && chat.isVerified) {
      priority += VERIFIED_PRIORITY_BASE; // ~100 years in seconds
    }

    if (priorityIds && priorityIds.includes(id)) {
      priority = Date.now() + PINNED_PRIORITY_BASE + (priorityIds.length - priorityIds.indexOf(id));
    }

    return priority;
  }, 'desc');
}
