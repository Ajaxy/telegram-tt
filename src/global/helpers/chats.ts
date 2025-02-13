import type {
  ApiChat,
  ApiChatAdminRights,
  ApiChatBannedRights,
  ApiChatFolder,
  ApiChatFullInfo,
  ApiChatInviteInfo,
  ApiPeer,
  ApiTopic,
  ApiUser,
} from '../../api/types';
import type { OldLangFn } from '../../hooks/useOldLang';
import type {
  CustomPeer, NotifyException, NotifySettings, ThreadId,
} from '../../types';
import type { LangFn } from '../../util/localization';
import { MAIN_THREAD_ID } from '../../api/types';

import {
  ANONYMOUS_USER_ID,
  ARCHIVED_FOLDER_ID, CHANNEL_ID_LENGTH, GENERAL_TOPIC_ID, REPLIES_USER_ID, TME_LINK_PREFIX,
  VERIFICATION_CODES_USER_ID,
} from '../../config';
import { formatDateToString, formatTime } from '../../util/dates/dateFormat';
import { getGlobal } from '..';
import { isSystemBot } from './bots';
import { getMainUsername, getUserFirstOrLastName } from './users';

const FOREVER_BANNED_DATE = Date.now() / 1000 + 31622400; // 366 days

export function isUserId(entityId: string) {
  return !entityId.startsWith('-');
}

export function isPeerChat(entity: ApiPeer): entity is ApiChat {
  return 'title' in entity;
}

export function isPeerUser(entity: ApiPeer): entity is ApiUser {
  return !isPeerChat(entity);
}

export function isChannelId(entityId: string) {
  return entityId.length === CHANNEL_ID_LENGTH && entityId.startsWith('-1');
}

export function toChannelId(mtpId: string) {
  return `-1${mtpId.padStart(CHANNEL_ID_LENGTH - 2, '0')}`;
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

export function isChatWithVerificationCodesBot(chatId: string) {
  return chatId === VERIFICATION_CODES_USER_ID;
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

export function getChatTitle(lang: OldLangFn | LangFn, chat: ApiChat, isSelf = false) {
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
  avatarPhotoId = owner.avatarPhotoId,
) {
  if (!avatarPhotoId) {
    return undefined;
  }

  switch (size) {
    case 'big':
      return `profile${owner.id}?${avatarPhotoId}`;
    default:
      return `avatar${owner.id}?${avatarPhotoId}`;
  }
}

export function isChatAdmin(chat: ApiChat) {
  return Boolean(chat.adminRights || chat.isCreator);
}

export function getHasAdminRight(chat: ApiChat, key: keyof ApiChatAdminRights) {
  return chat.adminRights?.[key] || false;
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
  chat: ApiChat, topic?: ApiTopic, isMessageThread?: boolean, chatFullInfo?: ApiChatFullInfo,
) {
  if (topic) {
    if (chat.isForum) {
      if (chat.isNotJoined) {
        return false;
      }

      if (topic?.isClosed && !topic.isOwner && !getHasAdminRight(chat, 'manageTopics')) {
        return false;
      }
    }
  }

  if (chat.isRestricted || chat.isForbidden || chat.migratedTo
    || (!isMessageThread && chat.isNotJoined) || isSystemBot(chat.id) || isAnonymousForwardsChat(chat.id)) {
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
  lang: OldLangFn,
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
  lang: OldLangFn,
  chat?: ApiChat,
  threadId: ThreadId = MAIN_THREAD_ID,
  topics?: Record<number, ApiTopic>,
  isReplying?: boolean,
) {
  if (!chat?.isForum) {
    return undefined;
  }

  if (threadId === MAIN_THREAD_ID) {
    if (isReplying || (topics && !topics[GENERAL_TOPIC_ID]?.isClosed)) return undefined;
    return lang('lng_forum_replies_only');
  }

  const topic = topics?.[Number(threadId)];
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

export function getFolderDescriptionText(lang: OldLangFn, folder: ApiChatFolder, chatsCount?: number) {
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

export function getMessageSenderName(lang: OldLangFn, chatId: string, sender?: ApiPeer) {
  if (!sender || isUserId(chatId)) {
    return undefined;
  }

  if (isPeerChat(sender)) {
    if (chatId === sender.id) return undefined;

    return sender.title;
  }

  if (sender.isSelf) {
    return lang('FromYou');
  }

  return getUserFirstOrLastName(sender);
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

export function getGroupStatus(lang: OldLangFn, chat: ApiChat) {
  const chatTypeString = lang(getChatTypeString(chat));
  const { membersCount } = chat;

  if (chat.isRestricted) {
    return chatTypeString === 'Channel' ? 'channel is inaccessible' : 'group is inaccessible';
  }

  if (!membersCount) {
    return chatTypeString;
  }

  return chatTypeString === 'Channel'
    ? lang('Subscribers', membersCount, 'i')
    : lang('Members', membersCount, 'i');
}

export function getCustomPeerFromInvite(invite: ApiChatInviteInfo): CustomPeer {
  const {
    title, color, isVerified, isFake, isScam,
  } = invite;
  return {
    isCustomPeer: true,
    title,
    peerColorId: color,
    isVerified,
    fakeType: isFake ? 'fake' : isScam ? 'scam' : undefined,
  };
}
