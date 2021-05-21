import {
  ApiChat,
  ApiUser,
  ApiChatBannedRights,
  ApiChatAdminRights,
  ApiChatFolder,
  MAIN_THREAD_ID,
} from '../../api/types';

import { ARCHIVED_FOLDER_ID } from '../../config';
import { orderBy } from '../../util/iteratees';
import { getUserFirstOrLastName } from './users';
import { getTranslation } from '../../util/langProvider';
import { LangFn } from '../../hooks/useLang';

export function isChatPrivate(chatId: number) {
  return chatId > 0;
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
export function getChatTitle(chat: ApiChat, user?: ApiUser, isSelf = false) {
  if (isSelf || (user && chat.id === user.id && user.isSelf)) {
    return getTranslation('SavedMessages');
  }
  return chat.title || getTranslation('HiddenName');
}

export function getChatDescription(chat: ApiChat) {
  if (!chat.fullInfo) {
    return undefined;
  }
  return chat.fullInfo.about;
}

export function getChatLink(chat: ApiChat) {
  const { username } = chat;
  const { inviteLink } = chat.fullInfo || {};

  if (inviteLink && inviteLink.length) {
    return inviteLink;
  }

  return username ? `t.me/${username}` : '';
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
    (chat.currentUserBannedRights && chat.currentUserBannedRights[key])
    || (chat.defaultBannedRights && chat.defaultBannedRights[key]),
  );
}

export function getCanPostInChat(chat: ApiChat, threadId: number) {
  if (threadId !== MAIN_THREAD_ID) {
    return true;
  }

  if (chat.isRestricted || chat.migratedTo || chat.isNotJoined) {
    return false;
  }

  if (chat.isCreator) {
    return true;
  }

  if (isChatPrivate(chat.id)) {
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
    canAttachPolls: (isAdmin || !isUserRightBanned(chat, 'sendPolls')) && (!isChatPrivate(chat.id) || isChatWithBot),
    canSendStickers: isAdmin || !isUserRightBanned(chat, 'sendStickers'),
    canSendGifs: isAdmin || !isUserRightBanned(chat, 'sendGifs'),
    canAttachEmbedLinks: isAdmin || !isUserRightBanned(chat, 'embedLinks'),
  };
}

export function getMessageSendingRestrictionReason(chat: ApiChat) {
  if (chat.currentUserBannedRights && chat.currentUserBannedRights.sendMessages) {
    return 'You are not allowed to send messages in this chat.';
  }
  if (chat.defaultBannedRights && chat.defaultBannedRights.sendMessages) {
    return 'Sending messages is not allowed in this chat.';
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
  return Math.max(chat.joinDate || 0, chat.lastMessage ? chat.lastMessage.date : 0);
}

export function isChatArchived(chat: ApiChat) {
  return chat.folderId === ARCHIVED_FOLDER_ID;
}

export function getCanDeleteChat(chat: ApiChat) {
  return isChatBasicGroup(chat) || ((isChatSuperGroup(chat) || isChatChannel(chat)) && chat.isCreator);
}

export function prepareFolderListIds(
  chatsById: Record<number, ApiChat>,
  usersById: Record<number, ApiUser>,
  folder: ApiChatFolder,
  chatIdsCache?: number[],
) {
  const excludedChatIds = folder.excludedChatIds ? new Set(folder.excludedChatIds) : undefined;
  const includedChatIds = folder.excludedChatIds ? new Set(folder.includedChatIds) : undefined;
  const pinnedChatIds = folder.excludedChatIds ? new Set(folder.pinnedChatIds) : undefined;
  const listIds = (chatIdsCache || Object.keys(chatsById).map(Number))
    .filter((id) => {
      return filterChatFolder(
        chatsById[id], folder, usersById, excludedChatIds, includedChatIds, pinnedChatIds,
      );
    });

  return [listIds, folder.pinnedChatIds] as const;
}

function filterChatFolder(
  chat: ApiChat,
  folder: ApiChatFolder,
  usersById: Record<number, ApiUser>,
  excludedChatIds?: Set<number>,
  includedChatIds?: Set<number>,
  pinnedChatIds?: Set<number>,
) {
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

  if (chat.isMuted && folder.excludeMuted) {
    return false;
  }

  if (!chat.unreadCount && !chat.unreadMentionsCount && !chat.hasUnreadMark && folder.excludeRead) {
    return false;
  }

  if (isChatPrivate(chat.id)) {
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
  chatsById: Record<number, ApiChat>,
  listIds: number[],
  orderedPinnedIds?: number[],
  folderType: 'all' | 'archived' | 'folder' = 'all',
) {
  function chatFilter(chat?: ApiChat) {
    if (!chat || !chat.lastMessage || chat.migratedTo) {
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

  const listedChats = listIds
    .map((id) => chatsById[id])
    .filter(chatFilter);

  const listIdsSet = new Set(listIds);
  const pinnedChats = orderedPinnedIds
    ? (
      orderedPinnedIds
        .map((id) => chatsById[id])
        .filter(chatFilter)
        .filter((chat) => listIdsSet.has(chat.id))
    )
    : [];

  const otherChats = orderBy(
    orderedPinnedIds
      ? listedChats.filter((chat) => !orderedPinnedIds.includes(chat.id))
      : listedChats,
    getChatOrder,
    'desc',
  );

  return {
    pinnedChats,
    otherChats,
  };
}

export function getFolderUnreadDialogs(
  chatsById: Record<number, ApiChat>,
  usersById: Record<number, ApiUser>,
  folder: ApiChatFolder,
  chatIdsCache: number[],
) {
  const [listIds] = prepareFolderListIds(chatsById, usersById, folder, chatIdsCache);

  const listedChats = listIds
    .map((id) => chatsById[id])
    .filter((chat) => (chat && chat.lastMessage && !chat.isRestricted && !chat.isNotJoined));

  const unreadDialogsCount = listedChats
    .reduce((total, chat) => (chat.unreadCount || chat.hasUnreadMark ? total + 1 : total), 0);

  const hasActiveDialogs = listedChats.some((chat) => (
    chat.unreadMentionsCount
    || (!chat.isMuted && (chat.unreadCount || chat.hasUnreadMark))
  ));

  return {
    unreadDialogsCount,
    hasActiveDialogs,
  };
}

export function getFolderDescriptionText(
  chatsById: Record<number, ApiChat>,
  usersById: Record<number, ApiUser>,
  folder: ApiChatFolder,
  chatIdsCache: number[],
  lang: LangFn,
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
    || (excludedChatIds && excludedChatIds.length)
    || (includedChatIds && includedChatIds.length)
  ) {
    const length = getFolderChatsCount(chatsById, usersById, folder, chatIdsCache);
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
  chatsById: Record<number, ApiChat>,
  usersById: Record<number, ApiUser>,
  folder: ApiChatFolder,
  chatIdsCache: number[],
) {
  const [listIds, pinnedIds] = prepareFolderListIds(chatsById, usersById, folder, chatIdsCache);
  const { pinnedChats, otherChats } = prepareChatList(chatsById, listIds, pinnedIds, 'folder');
  return pinnedChats.length + otherChats.length;
}

export function isChat(chatOrUser?: ApiUser | ApiChat): chatOrUser is ApiChat {
  if (!chatOrUser) {
    return false;
  }

  return chatOrUser.id < 0;
}

export function getMessageSenderName(chatId: number, sender?: ApiUser) {
  if (!sender || isChatPrivate(chatId)) {
    return undefined;
  }

  if (sender.isSelf) {
    return getTranslation('FromYou');
  }

  return getUserFirstOrLastName(sender);
}

export function sortChatIds(
  chatIds: number[],
  chatsById: Record<number, ApiChat>,
  shouldPrioritizeVerified = false,
  priorityIds?: number[],
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
      priority += 3e9; // ~100 years in seconds
    }

    if (priorityIds && priorityIds.includes(id)) {
      // Assuming that last message date can't be less than now,
      // this should place prioritized on top of the list.
      // Then we subtract index of `id` in `priorityIds` to preserve selected order
      priority += Date.now() + (priorityIds.length - priorityIds.indexOf(id));
    }

    return priority;
  }, 'desc');
}
