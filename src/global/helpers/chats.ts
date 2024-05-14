import type {
  ApiChat,
  ApiChatAdminRights,
  ApiChatBannedRights,
  ApiChatFolder,
  ApiChatFullInfo,
  ApiPeer,
  ApiTopic,
  ApiUser,
} from '../../api/types';
import type { LangFn } from '../../hooks/useLang';
import type { NotifyException, NotifySettings, ThreadId } from '../../types';
import { MAIN_THREAD_ID } from '../../api/types';

import {
  ANONYMOUS_USER_ID,
  ARCHIVED_FOLDER_ID, CHANNEL_ID_LENGTH, GENERAL_TOPIC_ID, REPLIES_USER_ID, TME_LINK_PREFIX,
} from '../../config';
import { formatDateToString, formatTime } from '../../util/date/dateFormat';
import { prepareSearchWordsForNeedle } from '../../util/searchWords';
import { getGlobal } from '..';
import { getMainUsername, getUserFirstOrLastName } from './users';

const FOREVER_BANNED_DATE = Date.now() / 1000 + 31622400; // 366 days

export function isUserId(entityId: string) {
  return !entityId.startsWith('-');
}

export function isChannelId(entityId: string) {
  return entityId.length === CHANNEL_ID_LENGTH && entityId.startsWith('-1');
}

export function toChannelId(mtpId: string) {
  return `-1${mtpId.padStart(CHANNEL_ID_LENGTH - 2, '0')}`;
}

export function isApiPeerChat(peer: ApiPeer): peer is ApiChat {
  return 'title' in peer;
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

export function isAnonymousForwardsChat(chatId: string) {
  return chatId === ANONYMOUS_USER_ID;
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

export function isUserRightBanned(chat: ApiChat, key: keyof ApiChatBannedRights, chatFullInfo?: ApiChatFullInfo) {
  const unrestrictedByBoosts = chatFullInfo?.boostsToUnrestrict
    && (chatFullInfo.boostsApplied || 0) >= chatFullInfo.boostsToUnrestrict;
  return Boolean(
    (chat.currentUserBannedRights?.[key])
    || (chat.defaultBannedRights?.[key] && !unrestrictedByBoosts),
  );
}

export function getCanPostInChat(
  chat: ApiChat, threadId: ThreadId, isMessageThread?: boolean, chatFullInfo?: ApiChatFullInfo,
) {
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
    || (!isMessageThread && chat.isNotJoined) || isChatWithRepliesBot(chat.id) || isAnonymousForwardsChat(chat.id)) {
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

  return isChatAdmin(chat) || !isUserRightBanned(chat, 'sendMessages', chatFullInfo);
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
  chatFullInfo?: ApiChatFullInfo,
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
    canAttachMedia: isAdmin || isStoryReply || !isUserRightBanned(chat, 'sendMedia', chatFullInfo),
    canAttachPolls: !isStoryReply
      && (isAdmin || !isUserRightBanned(chat, 'sendPolls', chatFullInfo))
      && (!isUserId(chat.id) || isChatWithBot),
    canSendStickers: isAdmin || isStoryReply || !isUserRightBanned(chat, 'sendStickers', chatFullInfo),
    canSendGifs: isAdmin || isStoryReply || !isUserRightBanned(chat, 'sendGifs', chatFullInfo),
    canAttachEmbedLinks: !isStoryReply && (isAdmin || !isUserRightBanned(chat, 'embedLinks', chatFullInfo)),
    canSendPhotos: isAdmin || isStoryReply || !isUserRightBanned(chat, 'sendPhotos', chatFullInfo),
    canSendVideos: isAdmin || isStoryReply || !isUserRightBanned(chat, 'sendVideos', chatFullInfo),
    canSendRoundVideos: isAdmin || isStoryReply || !isUserRightBanned(chat, 'sendRoundvideos', chatFullInfo),
    canSendAudios: isAdmin || isStoryReply || !isUserRightBanned(chat, 'sendAudios', chatFullInfo),
    canSendVoices: isAdmin || isStoryReply || !isUserRightBanned(chat, 'sendVoices', chatFullInfo),
    canSendPlainText: isAdmin || isStoryReply || !isUserRightBanned(chat, 'sendPlain', chatFullInfo),
    canSendDocuments: isAdmin || isStoryReply || !isUserRightBanned(chat, 'sendDocs', chatFullInfo),
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
  lang: LangFn, chat?: ApiChat, threadId: ThreadId = MAIN_THREAD_ID, isReplying?: boolean,
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

    return searchWords(translatedTitle) || Boolean(chat.usernames?.find(({ username }) => searchWords(username)));
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
  return isChannelId(peerId)
    // Remove -1 and leading zeros
    ? peerId.replace(/^-10+/, '')
    : peerId.replace('-', '');
}

export function getPeerIdDividend(peerId: string) {
  return Math.abs(Number(getCleanPeerId(peerId)));
}

export function getPeerColorKey(peer: ApiPeer | undefined) {
  if (peer?.color?.color) return peer.color.color;

  return peer ? getPeerIdDividend(peer.id) % 7 : 0;
}

export function getPeerColorCount(peer: ApiPeer) {
  const key = getPeerColorKey(peer);
  // eslint-disable-next-line eslint-multitab-tt/no-immediate-global
  return getGlobal().peerColors?.general[key].colors?.length || 1;
}

export function getIsSavedDialog(chatId: string, threadId: ThreadId | undefined, currentUserId: string | undefined) {
  return chatId === currentUserId && threadId !== MAIN_THREAD_ID;
}
