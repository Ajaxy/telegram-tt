import type {
  ApiChat,
  ApiChatAdminRights,
  ApiChatBannedRights,
  ApiChatFolder,
  ApiChatFullInfo,
  ApiChatInviteInfo,
  ApiMessage,
  ApiPeer,
  ApiPeerColorCollectible,
  ApiPreparedInlineMessage,
  ApiTopic,
} from '../../api/types';
import type { OldLangFn } from '../../hooks/useOldLang';
import type {
  CustomPeer, ThreadId,
} from '../../types';
import type { RegularLangKey } from '../../types/language';
import type { LangFn } from '../../util/localization';
import { MAIN_THREAD_ID } from '../../api/types';

import {
  ANONYMOUS_USER_ID,
  ARCHIVED_FOLDER_ID, GENERAL_TOPIC_ID, REPLIES_USER_ID, TME_LINK_PREFIX,
  VERIFICATION_CODES_USER_ID,
} from '../../config';
import { formatDateToString, formatTime } from '../../util/dates/dateFormat';
import { getPeerIdDividend, isUserId } from '../../util/entities/ids';
import { getServerTime } from '../../util/serverTime';
import { selectIsChatRestricted } from '../selectors';
import { getGlobal } from '..';
import { isSystemBot } from './bots';
import { getMainUsername } from './users';

const FOREVER_BANNED_DATE = Date.now() / 1000 + 31622400; // 366 days

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

export function isChatMonoforum(chat: ApiChat) {
  return chat.isMonoforum;
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

export function getChatTypeLangKey(chat: ApiChat): RegularLangKey {
  switch (chat.type) {
    case 'chatTypePrivate':
      return 'ChatTypePrivate';
    case 'chatTypeBasicGroup':
    case 'chatTypeSuperGroup':
      return 'ChatTypeGroup';
    case 'chatTypeChannel':
      return 'ChatTypeChannel';
    default:
      return 'ChatTypeFallback';
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

  const global = getGlobal();
  const isRestricted = selectIsChatRestricted(global, chat.id);
  if (isRestricted || chat.isForbidden || chat.migratedTo
    || (chat.isNotJoined && !isChatMonoforum(chat) && !isMessageThread)
    || isSystemBot(chat.id) || isAnonymousForwardsChat(chat.id)) {
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
  canAttachToDoLists: boolean;
}

export function getAllowedAttachmentOptions(
  chat?: ApiChat,
  chatFullInfo?: ApiChatFullInfo,
  isChatWithBot = false,
  isSavedMessages = false,
  isStoryReply = false,
  paidMessagesStars?: number,
  isInScheduledList = false,
): IAllowedAttachmentOptions {
  if (!chat || (paidMessagesStars && isInScheduledList)) {
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
      canAttachToDoLists: false,
    };
  }

  const isAdmin = isChatAdmin(chat);

  return {
    canAttachMedia: isAdmin || isStoryReply || !isUserRightBanned(chat, 'sendMedia', chatFullInfo),
    canAttachPolls: !isStoryReply && !chat.isMonoforum
      && (isAdmin || !isUserRightBanned(chat, 'sendPolls', chatFullInfo))
      && (!isUserId(chat.id) || isChatWithBot || isSavedMessages),
    canAttachToDoLists: !isStoryReply && !chat.isMonoforum && !isChatChannel(chat),
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
    return lang('ChatsPlural', { count: chatsCount }, { pluralValue: chatsCount });
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

export function isChatPublic(chat: ApiChat) {
  return chat.hasUsername;
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

export function getPeerColorKey(peer: ApiPeer | CustomPeer | undefined, isForAvatar?: boolean) {
  if (!peer) return 0;

  if ('isCustomPeer' in peer) {
    return peer.peerColorId;
  }

  if (peer.color) {
    if (peer.color.type === 'regular' && peer.color.color !== undefined) return peer.color.color;
    if (peer.color.type === 'collectible' && !isForAvatar) return undefined; // Custom colors
  }

  return getPeerIdDividend(peer.id) % 7;
}

export function getPeerColorCount(peer: ApiPeer) {
  const key = getPeerColorKey(peer);
  if (peer.color?.type === 'collectible') return getPeerColorCollectibleColorCount(peer.color);
  if (key === undefined) return 1;

  const global = getGlobal();
  return global.peerColors?.general[key].colors?.length || 1;
}

export function getPeerColorCollectibleColorCount(color: ApiPeerColorCollectible): number {
  return color.colors.length;
}

export function getIsSavedDialog(chatId: string, threadId: ThreadId | undefined, currentUserId: string | undefined) {
  return chatId === currentUserId && threadId !== MAIN_THREAD_ID;
}

export function getGroupStatus(lang: LangFn, chat: ApiChat) {
  const chatTypeKey = getChatTypeLangKey(chat);
  const isChannel = isChatChannel(chat);
  const { membersCount } = chat;

  const global = getGlobal();
  const isRestricted = selectIsChatRestricted(global, chat.id);
  if (isRestricted) {
    return isChannel ? lang('ChannelInaccessible') : lang('GroupInaccessible');
  }

  if (!membersCount) {
    return lang(chatTypeKey);
  }

  return isChannel
    ? lang('Subscribers', { count: membersCount }, { pluralValue: membersCount })
    : lang('NMembers', { count: membersCount }, { pluralValue: membersCount });
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

export function getMockPreparedMessageFromResult(botId: string, preparedMessage: ApiPreparedInlineMessage) {
  const { result } = preparedMessage;

  const inlineButtons = result?.sendMessage?.replyMarkup?.inlineButtons;

  return {
    chatId: botId,
    content: result.sendMessage.content,
    date: getServerTime(),
    id: 0,
    isOutgoing: true,
    viaBotId: botId,
    inlineButtons,
  } satisfies ApiMessage;
}
