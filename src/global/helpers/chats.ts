import type {
  ApiChat,
  ApiChatAdminRights,
  ApiChatBannedRights,
  ApiChatFolder,
  ApiPeer,
  ApiTopic,
  ApiUser,
} from '../../api/types';
import type { LangFn } from '../../hooks/useLang';
import type { NotifyException, NotifySettings } from '../../types';
import {
  MAIN_THREAD_ID,
} from '../../api/types';

import {
  ARCHIVED_FOLDER_ID, CHANNEL_ID_LENGTH, GENERAL_TOPIC_ID, REPLIES_USER_ID, TME_LINK_PREFIX,
} from '../../config';
import { formatDateToString, formatTime } from '../../util/dateFormat';
import { orderBy } from '../../util/iteratees';
import { prepareSearchWordsForNeedle } from '../../util/searchWords';
import { getMainUsername, getUserFirstOrLastName } from './users';

const FOREVER_BANNED_DATE = Date.now() / 1000 + 31622400; // 366 days

const VERIFIED_PRIORITY_BASE = 3e9;
const PINNED_PRIORITY_BASE = 3e8;
const USER_COLOR_KEYS = [1, 8, 5, 2, 7, 4, 6];

export function isUserId(entityId: string) {
  return !entityId.startsWith('-');
}

export function isChannelId(entityId: string) {
  return entityId.length === CHANNEL_ID_LENGTH && entityId.startsWith('-100');
}

export function toChannelId(mtpId: string) {
  return `-100${mtpId}`;
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

export function isChatWithTopics(chat: ApiChat) {
  if (chat.topics === undefined) return !!chat.topicsCount;

  return !!Object.values(chat.topics).filter((topic) => !topic.isClosed).length;
}

export function isChatSuperGroupWithoutTopics(chat: ApiChat) {
  return isChatSuperGroup(chat) && !isChatWithTopics(chat);
}

export function isChatSuperGroupWithTopics(chat: ApiChat) {
  return isChatSuperGroup(chat) && isChatWithTopics(chat);
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

export const QUOTE_APP = {
  doesChatSupportThreads: (chat: ApiChat | undefined) => chat && isChatSuperGroupWithoutTopics(chat),
};

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

export function getChatTitle(lang: LangFn, chat: ApiChat, isSelf = false) {
  if (isSelf) {
    return lang('SavedMessages');
  }
  return chat.title || lang('HiddenName');
}

export function getChatLink(chat: ApiChat) {
  const activeUsername = getMainUsername(chat);

  return activeUsername ? `${TME_LINK_PREFIX}${activeUsername}` : undefined;
}

export function getChatAvatarHash(
  owner: ApiPeer,
  size: 'normal' | 'big' = 'normal',
  avatarHash = owner.avatarHash,
) {
  if (!avatarHash) {
    return undefined;
  }

  switch (size) {
    case 'big':
      return `profile${owner.id}?${avatarHash}`;
    default:
      return `avatar${owner.id}?${avatarHash}`;
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

export function getCanManageTopic(chat: ApiChat, topic: ApiTopic) {
  if (topic.id === GENERAL_TOPIC_ID) return chat.isCreator;
  return chat.isCreator || getHasAdminRight(chat, 'manageTopics') || topic.isOwner;
}

export function isUserRightBanned(chat: ApiChat, key: keyof ApiChatBannedRights) {
  return Boolean(
    (chat.currentUserBannedRights?.[key])
    || (chat.defaultBannedRights?.[key]),
  );
}

export function getCanPostInChat(chat: ApiChat, threadId: number, isComments?: boolean) {
  if (threadId !== MAIN_THREAD_ID) {
    if (chat.isForum) {
      if (chat.isNotJoined) {
        return false;
      }

      const topic = chat.topics?.[threadId];
      if (topic?.isClosed && !topic.isOwner && !getHasAdminRight(chat, 'manageTopics')) {
        return false;
      }
    }
  }

  if (chat.isRestricted || chat.isForbidden || chat.migratedTo
    || (!isComments && chat.isNotJoined) || isChatWithRepliesBot(chat.id)) {
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
  canSendPhotos: boolean;
  canSendVideos: boolean;
  canSendRoundVideos: boolean;
  canSendAudios: boolean;
  canSendVoices: boolean;
  canSendPlainText: boolean;
  canSendDocuments: boolean;
}

export function getAllowedAttachmentOptions(
  chat?: ApiChat,
  isChatWithBot = false,
  isStoryReply = false,
): IAllowedAttachmentOptions {
  if (!chat) {
    return {
      canAttachMedia: false,
      canAttachPolls: false,
      canSendStickers: false,
      canSendGifs: false,
      canAttachEmbedLinks: false,
      canSendPhotos: false,
      canSendVideos: false,
      canSendRoundVideos: false,
      canSendAudios: false,
      canSendVoices: false,
      canSendPlainText: false,
      canSendDocuments: false,
    };
  }

  const isAdmin = isChatAdmin(chat);

  return {
    canAttachMedia: isAdmin || isStoryReply || !isUserRightBanned(chat, 'sendMedia'),
    canAttachPolls: !isStoryReply
      && (isAdmin || !isUserRightBanned(chat, 'sendPolls'))
      && (!isUserId(chat.id) || isChatWithBot),
    canSendStickers: isAdmin || isStoryReply || !isUserRightBanned(chat, 'sendStickers'),
    canSendGifs: isAdmin || isStoryReply || !isUserRightBanned(chat, 'sendGifs'),
    canAttachEmbedLinks: !isStoryReply && (isAdmin || !isUserRightBanned(chat, 'embedLinks')),
    canSendPhotos: isAdmin || isStoryReply || !isUserRightBanned(chat, 'sendPhotos'),
    canSendVideos: isAdmin || isStoryReply || !isUserRightBanned(chat, 'sendVideos'),
    canSendRoundVideos: isAdmin || isStoryReply || !isUserRightBanned(chat, 'sendRoundvideos'),
    canSendAudios: isAdmin || isStoryReply || !isUserRightBanned(chat, 'sendAudios'),
    canSendVoices: isAdmin || isStoryReply || !isUserRightBanned(chat, 'sendVoices'),
    canSendPlainText: isAdmin || isStoryReply || !isUserRightBanned(chat, 'sendPlain'),
    canSendDocuments: isAdmin || isStoryReply || !isUserRightBanned(chat, 'sendDocs'),
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
          [formatDateToString(new Date(untilDate * 1000), lang.code), formatTime(lang, untilDate * 1000)],
        ),
      )
      : lang('Channel.Persmission.Denied.SendMessages.Forever');
  }

  if (defaultBannedRights?.sendMessages) {
    return lang('Channel.Persmission.Denied.SendMessages.DefaultRestrictedText');
  }

  return undefined;
}

export function getForumComposerPlaceholder(
  lang: LangFn, chat?: ApiChat, threadId = MAIN_THREAD_ID, isReplying?: boolean,
) {
  if (!chat?.isForum) {
    return undefined;
  }

  if (threadId === MAIN_THREAD_ID) {
    if (isReplying || (chat.topics && !chat.topics[GENERAL_TOPIC_ID]?.isClosed)) return undefined;
    return lang('lng_forum_replies_only');
  }

  const topic = chat.topics?.[threadId];
  if (!topic) {
    return undefined;
  }

  if (topic.isClosed && !topic.isOwner && !getHasAdminRight(chat, 'manageTopics')) {
    return lang('TopicClosedByAdmin');
  }

  return undefined;
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

export function getFolderDescriptionText(lang: LangFn, folder: ApiChatFolder, chatsCount?: number) {
  const {
    excludedChatIds, includedChatIds,
    bots, groups, contacts, nonContacts, channels,
  } = folder;

  const filters = [bots, groups, contacts, nonContacts, channels];

  // If folder has multiple additive filters or uses include/exclude lists,
  // we display folder chats count
  if (
    chatsCount !== undefined && (
      Object.values(filters).filter(Boolean).length > 1
      || (excludedChatIds?.length)
      || (includedChatIds?.length)
    )) {
    return lang('Chats', chatsCount);
  }

  // Otherwise, we return a short description of a single filter
  if (bots) {
    return lang('FilterBots');
  } else if (groups) {
    return lang('FilterGroups');
  } else if (channels) {
    return lang('FilterChannels');
  } else if (contacts) {
    return lang('FilterContacts');
  } else if (nonContacts) {
    return lang('FilterNonContacts');
  } else {
    return undefined;
  }
}

export function getMessageSenderName(lang: LangFn, chatId: string, sender?: ApiPeer) {
  if (!sender || isUserId(chatId)) {
    return undefined;
  }

  if (!isUserId(sender.id)) {
    if (chatId === sender.id) return undefined;

    return (sender as ApiChat).title;
  }

  sender = sender as ApiUser;

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

export function filterChatsByName(
  lang: LangFn,
  chatIds: string[],
  chatsById: Record<string, ApiChat>,
  query?: string,
  currentUserId?: string,
) {
  if (!query) {
    return chatIds;
  }

  const searchWords = prepareSearchWordsForNeedle(query);

  return chatIds.filter((id) => {
    const chat = chatsById[id];
    if (!chat) {
      return false;
    }
    const isSelf = id === currentUserId;

    const translatedTitle = getChatTitle(lang, chat, isSelf);
    if (isSelf) {
      // Search both "Saved Messages" and user title
      return searchWords(translatedTitle) || searchWords(chat.title);
    }

    return searchWords(translatedTitle);
  });
}

export function isChatPublic(chat: ApiChat) {
  return chat.usernames?.some(({ isActive }) => isActive);
}

export function getOrderedTopics(
  topics: ApiTopic[], pinnedOrder?: number[], shouldSortByLastMessage = false,
): ApiTopic[] {
  if (shouldSortByLastMessage) {
    return topics.sort((a, b) => b.lastMessageId - a.lastMessageId);
  } else {
    const pinned = topics.filter((topic) => topic.isPinned);
    const ordered = topics
      .filter((topic) => !topic.isPinned && !topic.isHidden)
      .sort((a, b) => b.lastMessageId - a.lastMessageId);
    const hidden = topics.filter((topic) => !topic.isPinned && topic.isHidden)
      .sort((a, b) => b.lastMessageId - a.lastMessageId);

    const pinnedOrdered = pinnedOrder
      ? pinnedOrder.map((id) => pinned.find((topic) => topic.id === id)).filter(Boolean) : pinned;

    return [...pinnedOrdered, ...ordered, ...hidden];
  }
}

export function getCleanPeerId(peerId: string) {
  return isChannelId(peerId) ? peerId.replace('-100', '') : peerId.replace('-', '');
}

export function getPeerIdDividend(peerId: string) {
  return Math.abs(Number(getCleanPeerId(peerId)));
}

// https://github.com/telegramdesktop/tdesktop/blob/371510cfe23b0bd226de8c076bc49248fbe40c26/Telegram/SourceFiles/data/data_peer.cpp#L53
export function getPeerColorKey(peer: ApiPeer | undefined) {
  const index = peer ? getPeerIdDividend(peer.id) % 7 : 0;

  return USER_COLOR_KEYS[index];
}
