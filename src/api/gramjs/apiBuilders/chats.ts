import type BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiBotCommand,
  ApiChat,
  ApiChatAdminRights,
  ApiChatBannedRights,
  ApiChatFolder,
  ApiChatInviteImporter,
  ApiChatlistExportedInvite,
  ApiChatlistInvite,
  ApiChatMember,
  ApiChatReactions,
  ApiChatSettings,
  ApiExportedInvite,
  ApiRestrictionReason,
  ApiSendAsPeerId,
  ApiTopic,
} from '../../types';

import { omitUndefined, pick, pickTruthy } from '../../../util/iteratees';
import { getServerTime, getServerTimeOffset } from '../../../util/serverTime';
import { buildApiUsernames } from './common';
import { omitVirtualClassFields } from './helpers';
import {
  buildApiEmojiStatus,
  buildApiPeerColor,
  buildApiPeerId,
  getApiChatIdFromMtpPeer,
  isPeerChat,
  isPeerUser,
} from './peers';
import { buildApiReaction } from './reactions';

type PeerEntityApiChatFields = Omit<ApiChat, (
  'id' | 'type' | 'title' |
  'lastReadOutboxMessageId' | 'lastReadInboxMessageId' |
  'unreadCount' | 'unreadMentionsCount' | 'isMuted'
)>;

function buildApiChatFieldsFromPeerEntity(
  peerEntity: GramJs.TypeUser | GramJs.TypeChat,
  isSupport = false,
): PeerEntityApiChatFields {
  const isMin = Boolean('min' in peerEntity && peerEntity.min);
  const accessHash = ('accessHash' in peerEntity) ? String(peerEntity.accessHash) : undefined;
  const hasVideoAvatar = 'photo' in peerEntity && peerEntity.photo && 'hasVideo' in peerEntity.photo
    && peerEntity.photo.hasVideo;
  const avatarHash = ('photo' in peerEntity) && peerEntity.photo ? buildAvatarHash(peerEntity.photo) : undefined;
  const isSignaturesShown = Boolean('signatures' in peerEntity && peerEntity.signatures);
  const hasPrivateLink = Boolean('hasLink' in peerEntity && peerEntity.hasLink);
  const isScam = Boolean('scam' in peerEntity && peerEntity.scam);
  const isFake = Boolean('fake' in peerEntity && peerEntity.fake);
  const isJoinToSend = Boolean('joinToSend' in peerEntity && peerEntity.joinToSend);
  const isJoinRequest = Boolean('joinRequest' in peerEntity && peerEntity.joinRequest);
  const usernames = buildApiUsernames(peerEntity);
  const isForum = Boolean('forum' in peerEntity && peerEntity.forum);
  const areStoriesHidden = Boolean('storiesHidden' in peerEntity && peerEntity.storiesHidden);
  const maxStoryId = 'storiesMaxId' in peerEntity ? peerEntity.storiesMaxId : undefined;
  const storiesUnavailable = Boolean('storiesUnavailable' in peerEntity && peerEntity.storiesUnavailable);
  const color = ('color' in peerEntity && peerEntity.color) ? buildApiPeerColor(peerEntity.color) : undefined;
  const emojiStatus = ('emojiStatus' in peerEntity && peerEntity.emojiStatus)
    ? buildApiEmojiStatus(peerEntity.emojiStatus) : undefined;

  return omitUndefined({
    isMin,
    hasPrivateLink,
    isSignaturesShown,
    usernames,
    accessHash,
    hasVideoAvatar,
    avatarHash,
    ...('verified' in peerEntity && { isVerified: peerEntity.verified }),
    ...('callActive' in peerEntity && { isCallActive: peerEntity.callActive }),
    ...('callNotEmpty' in peerEntity && { isCallNotEmpty: peerEntity.callNotEmpty }),
    ...('date' in peerEntity && { creationDate: peerEntity.date }),
    ...('participantsCount' in peerEntity && peerEntity.participantsCount !== undefined && {
      membersCount: peerEntity.participantsCount,
    }),
    ...('noforwards' in peerEntity && { isProtected: Boolean(peerEntity.noforwards) }),
    isSupport: isSupport || undefined,
    ...buildApiChatPermissions(peerEntity),
    ...('creator' in peerEntity && { isCreator: peerEntity.creator }),
    ...buildApiChatRestrictions(peerEntity),
    ...buildApiChatMigrationInfo(peerEntity),
    fakeType: isScam ? 'scam' : (isFake ? 'fake' : undefined),
    color,
    isJoinToSend,
    isJoinRequest,
    isForum,
    areStoriesHidden,
    maxStoryId,
    hasStories: Boolean(maxStoryId) && !storiesUnavailable,
    emojiStatus,
  });
}

export function buildApiChatFromDialog(
  dialog: GramJs.Dialog,
  peerEntity: GramJs.TypeUser | GramJs.TypeChat,
): ApiChat {
  const {
    peer, folderId, unreadMark, unreadCount, unreadMentionsCount, unreadReactionsCount,
    notifySettings: { silent, muteUntil },
    readOutboxMaxId, readInboxMaxId, draft, viewForumAsMessages,
  } = dialog;
  const isMuted = silent || (typeof muteUntil === 'number' && getServerTime() < muteUntil);

  return {
    id: getApiChatIdFromMtpPeer(peer),
    ...(folderId && { folderId }),
    type: getApiChatTypeFromPeerEntity(peerEntity),
    title: getApiChatTitleFromMtpPeer(peer, peerEntity),
    lastReadOutboxMessageId: readOutboxMaxId,
    lastReadInboxMessageId: readInboxMaxId,
    unreadCount,
    unreadMentionsCount,
    unreadReactionsCount,
    isMuted,
    muteUntil,
    ...(unreadMark && { hasUnreadMark: true }),
    ...(draft instanceof GramJs.DraftMessage && { draftDate: draft.date }),
    ...(viewForumAsMessages && { isForumAsMessages: true }),
    ...buildApiChatFieldsFromPeerEntity(peerEntity),
  };
}

function buildApiChatPermissions(peerEntity: GramJs.TypeUser | GramJs.TypeChat): {
  adminRights?: ApiChatAdminRights;
  currentUserBannedRights?: ApiChatBannedRights;
  defaultBannedRights?: ApiChatBannedRights;
} {
  if (!(peerEntity instanceof GramJs.Chat || peerEntity instanceof GramJs.Channel)) {
    return {};
  }

  return {
    adminRights: peerEntity.adminRights ? omitVirtualClassFields(peerEntity.adminRights) : undefined,
    currentUserBannedRights: 'bannedRights' in peerEntity && peerEntity.bannedRights
      ? omitVirtualClassFields(peerEntity.bannedRights)
      : undefined,
    defaultBannedRights: peerEntity.defaultBannedRights
      ? omitVirtualClassFields(peerEntity.defaultBannedRights)
      : undefined,
  };
}

function buildApiChatRestrictions(peerEntity: GramJs.TypeUser | GramJs.TypeChat): {
  isNotJoined?: boolean;
  isForbidden?: boolean;
  isRestricted?: boolean;
  restrictionReason?: ApiRestrictionReason;
} {
  if (peerEntity instanceof GramJs.ChatForbidden) {
    return {
      isForbidden: true,
    };
  }

  if (peerEntity instanceof GramJs.ChannelForbidden) {
    return {
      isRestricted: true,
    };
  }

  const restrictions = {};

  if ('restricted' in peerEntity) {
    const restrictionReason = peerEntity.restricted
      ? buildApiChatRestrictionReason(peerEntity.restrictionReason)
      : undefined;

    if (restrictionReason) {
      Object.assign(restrictions, {
        isRestricted: true,
        restrictionReason,
      });
    }
  }

  if (peerEntity instanceof GramJs.Chat) {
    Object.assign(restrictions, {
      isNotJoined: peerEntity.left,
    });
  }

  if (peerEntity instanceof GramJs.Channel) {
    Object.assign(restrictions, {
      // `left` is weirdly set to `true` on all channels never joined before
      isNotJoined: peerEntity.left,
    });
  }

  return restrictions;
}

function buildApiChatMigrationInfo(peerEntity: GramJs.TypeChat): {
  migratedTo?: {
    chatId: string;
    accessHash?: string;
  };
} {
  if (
    'migratedTo' in peerEntity
    && peerEntity.migratedTo
    && !(peerEntity.migratedTo instanceof GramJs.InputChannelEmpty)
  ) {
    return {
      migratedTo: {
        chatId: getApiChatIdFromMtpPeer(peerEntity.migratedTo),
        ...(peerEntity.migratedTo instanceof GramJs.InputChannel && {
          accessHash: String(peerEntity.migratedTo.accessHash),
        }),
      },
    };
  }

  return {};
}

function buildApiChatRestrictionReason(
  restrictionReasons?: GramJs.RestrictionReason[],
): ApiRestrictionReason | undefined {
  if (!restrictionReasons) {
    return undefined;
  }

  const targetReason = restrictionReasons.find(({ platform }) => platform === 'all');
  return targetReason ? pick(targetReason, ['reason', 'text']) : undefined;
}

export function buildApiChatFromPreview(
  preview: GramJs.TypeChat | GramJs.TypeUser,
  isSupport = false,
): ApiChat | undefined {
  if (preview instanceof GramJs.ChatEmpty || preview instanceof GramJs.UserEmpty) {
    return undefined;
  }
  const id = buildApiPeerId(
    preview.id,
    preview instanceof GramJs.User ? 'user'
      : (preview instanceof GramJs.Chat || preview instanceof GramJs.ChatForbidden) ? 'chat' : 'channel',
  );

  return {
    id,
    type: getApiChatTypeFromPeerEntity(preview),
    title: preview instanceof GramJs.User ? getUserName(preview) : preview.title,
    ...buildApiChatFieldsFromPeerEntity(preview, isSupport),
  };
}

export function getApiChatTypeFromPeerEntity(peerEntity: GramJs.TypeChat | GramJs.TypeUser) {
  if (peerEntity instanceof GramJs.User || peerEntity instanceof GramJs.UserEmpty) {
    return 'chatTypePrivate';
  } else if (
    peerEntity instanceof GramJs.Chat
    || peerEntity instanceof GramJs.ChatForbidden
    || peerEntity instanceof GramJs.ChatEmpty
  ) {
    return 'chatTypeBasicGroup';
  } else {
    return peerEntity.megagroup ? 'chatTypeSuperGroup' : 'chatTypeChannel';
  }
}

export function getPeerKey(peer: GramJs.TypePeer) {
  if (isPeerUser(peer)) {
    return `user${peer.userId}`;
  } else if (isPeerChat(peer)) {
    return `chat${peer.chatId}`;
  } else {
    return `chat${peer.channelId}`;
  }
}

export function getApiChatTitleFromMtpPeer(peer: GramJs.TypePeer, peerEntity: GramJs.User | GramJs.Chat) {
  if (isPeerUser(peer)) {
    return getUserName(peerEntity as GramJs.User);
  } else {
    return (peerEntity as GramJs.Chat).title;
  }
}

function getUserName(user: GramJs.User) {
  return user.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
    : (user.lastName || '');
}

export function buildAvatarHash(photo: GramJs.TypeUserProfilePhoto | GramJs.TypeChatPhoto) {
  if ('photoId' in photo) {
    return String(photo.photoId);
  }

  return undefined;
}

export function buildChatMember(
  member: GramJs.TypeChatParticipant | GramJs.TypeChannelParticipant,
): ApiChatMember | undefined {
  const userId = (member instanceof GramJs.ChannelParticipantBanned || member instanceof GramJs.ChannelParticipantLeft)
    ? getApiChatIdFromMtpPeer(member.peer)
    : buildApiPeerId(member.userId, 'user');

  return {
    userId,
    inviterId: 'inviterId' in member && member.inviterId
      ? buildApiPeerId(member.inviterId as BigInt.BigInteger, 'user')
      : undefined,
    joinedDate: 'date' in member ? member.date : undefined,
    kickedByUserId: 'kickedBy' in member && member.kickedBy ? buildApiPeerId(member.kickedBy, 'user') : undefined,
    promotedByUserId: 'promotedBy' in member && member.promotedBy
      ? buildApiPeerId(member.promotedBy, 'user')
      : undefined,
    bannedRights: 'bannedRights' in member ? omitVirtualClassFields(member.bannedRights) : undefined,
    adminRights: 'adminRights' in member ? omitVirtualClassFields(member.adminRights) : undefined,
    customTitle: 'rank' in member ? member.rank : undefined,
    ...((member instanceof GramJs.ChannelParticipantAdmin || member instanceof GramJs.ChatParticipantAdmin) && {
      isAdmin: true,
    }),
    ...((member instanceof GramJs.ChannelParticipantCreator || member instanceof GramJs.ChatParticipantCreator) && {
      isOwner: true,
    }),
  };
}

export function buildChatMembers(
  participants: GramJs.TypeChatParticipants | GramJs.channels.ChannelParticipants,
) {
  // Duplicate code because of TS union-type shenanigans
  if (participants instanceof GramJs.ChatParticipants) {
    return participants.participants.map(buildChatMember).filter(Boolean);
  }
  if (participants instanceof GramJs.channels.ChannelParticipants) {
    return participants.participants.map(buildChatMember).filter(Boolean);
  }

  return undefined;
}

export function buildChatTypingStatus(
  update: GramJs.UpdateUserTyping | GramJs.UpdateChatUserTyping | GramJs.UpdateChannelUserTyping,
) {
  let action: string = '';
  let emoticon: string | undefined;
  if (update.action instanceof GramJs.SendMessageCancelAction) {
    return undefined;
  } else if (update.action instanceof GramJs.SendMessageTypingAction) {
    action = 'lng_user_typing';
  } else if (update.action instanceof GramJs.SendMessageRecordVideoAction) {
    action = 'lng_send_action_record_video';
  } else if (update.action instanceof GramJs.SendMessageUploadVideoAction) {
    action = 'lng_send_action_upload_video';
  } else if (update.action instanceof GramJs.SendMessageRecordAudioAction) {
    action = 'lng_send_action_record_audio';
  } else if (update.action instanceof GramJs.SendMessageUploadAudioAction) {
    action = 'lng_send_action_upload_audio';
  } else if (update.action instanceof GramJs.SendMessageUploadPhotoAction) {
    action = 'lng_send_action_upload_photo';
  } else if (update.action instanceof GramJs.SendMessageUploadDocumentAction) {
    action = 'lng_send_action_upload_file';
  } else if (update.action instanceof GramJs.SendMessageGeoLocationAction) {
    action = 'selecting a location to share';
  } else if (update.action instanceof GramJs.SendMessageChooseContactAction) {
    action = 'selecting a contact to share';
  } else if (update.action instanceof GramJs.SendMessageGamePlayAction) {
    action = 'lng_playing_game';
  } else if (update.action instanceof GramJs.SendMessageRecordRoundAction) {
    action = 'lng_send_action_record_round';
  } else if (update.action instanceof GramJs.SendMessageUploadRoundAction) {
    action = 'lng_send_action_upload_round';
  } else if (update.action instanceof GramJs.SendMessageChooseStickerAction) {
    action = 'lng_send_action_choose_sticker';
  } else if (update.action instanceof GramJs.SpeakingInGroupCallAction) {
    return undefined;
  } else if (update.action instanceof GramJs.SendMessageEmojiInteractionSeen) {
    action = 'lng_user_action_watching_animations';
    emoticon = update.action.emoticon;
  } else if (update.action instanceof GramJs.SendMessageEmojiInteraction) {
    return undefined;
  }

  return {
    action,
    ...(emoticon && { emoji: emoticon }),
    ...(!(update instanceof GramJs.UpdateUserTyping) && { userId: getApiChatIdFromMtpPeer(update.fromId) }),
    timestamp: Date.now() + getServerTimeOffset() * 1000,
  };
}

export function buildApiChatFolder(filter: GramJs.DialogFilter | GramJs.DialogFilterChatlist): ApiChatFolder {
  if (filter instanceof GramJs.DialogFilterChatlist) {
    return {
      ...pickTruthy(filter, [
        'id', 'title', 'emoticon',
      ]),
      excludedChatIds: [],
      includedChatIds: filter.includePeers.map(getApiChatIdFromMtpPeer).filter(Boolean),
      pinnedChatIds: filter.pinnedPeers.map(getApiChatIdFromMtpPeer).filter(Boolean),
      hasMyInvites: filter.hasMyInvites,
      isChatList: true,
    };
  }

  return {
    ...pickTruthy(filter, [
      'id', 'title', 'emoticon', 'contacts', 'nonContacts', 'groups', 'bots',
      'excludeMuted', 'excludeRead', 'excludeArchived',
    ]),
    channels: filter.broadcasts,
    pinnedChatIds: filter.pinnedPeers.map(getApiChatIdFromMtpPeer).filter(Boolean),
    includedChatIds: filter.includePeers.map(getApiChatIdFromMtpPeer).filter(Boolean),
    excludedChatIds: filter.excludePeers.map(getApiChatIdFromMtpPeer).filter(Boolean),
  };
}

export function buildApiChatFolderFromSuggested({
  filter, description,
}: {
  filter: GramJs.TypeDialogFilter;
  description: string;
}): ApiChatFolder | undefined {
  if (!(filter instanceof GramJs.DialogFilter || filter instanceof GramJs.DialogFilterChatlist)) return undefined;
  return {
    ...buildApiChatFolder(filter),
    description,
  };
}

export function buildApiChatBotCommands(botInfos: GramJs.BotInfo[]) {
  return botInfos.reduce((botCommands, botInfo) => {
    const botId = buildApiPeerId(botInfo.userId!, 'user');

    if (botInfo.commands) {
      botCommands = botCommands.concat(botInfo.commands.map((mtpCommand) => ({
        botId,
        ...omitVirtualClassFields(mtpCommand),
      })));
    }

    return botCommands;
  }, [] as ApiBotCommand[]);
}

export function buildApiExportedInvite(invite: GramJs.ChatInviteExported): ApiExportedInvite {
  const {
    revoked,
    date,
    expireDate,
    link,
    permanent,
    startDate,
    usage,
    usageLimit,
    requested,
    requestNeeded,
    title,
    adminId,
  } = invite;
  return {
    isRevoked: revoked,
    date,
    expireDate,
    link,
    isPermanent: permanent,
    startDate,
    usage,
    usageLimit,
    isRequestNeeded: requestNeeded,
    requested,
    title,
    adminId: buildApiPeerId(adminId, 'user'),
  };
}

export function buildChatInviteImporter(importer: GramJs.ChatInviteImporter): ApiChatInviteImporter {
  const {
    userId,
    date,
    about,
    requested,
    viaChatlist,
  } = importer;
  return {
    userId: buildApiPeerId(userId, 'user'),
    date,
    about,
    isRequested: requested,
    isFromChatList: viaChatlist,
  };
}

export function buildApiChatSettings({
  autoarchived,
  reportSpam,
  addContact,
  blockContact,
}: GramJs.PeerSettings): ApiChatSettings {
  return {
    isAutoArchived: Boolean(autoarchived),
    canReportSpam: Boolean(reportSpam),
    canAddContact: Boolean(addContact),
    canBlockContact: Boolean(blockContact),
  };
}

export function buildApiChatReactions(chatReactions?: GramJs.TypeChatReactions): ApiChatReactions | undefined {
  if (chatReactions instanceof GramJs.ChatReactionsAll) {
    return {
      type: 'all',
      areCustomAllowed: chatReactions.allowCustom,
    };
  }
  if (chatReactions instanceof GramJs.ChatReactionsSome) {
    return {
      type: 'some',
      allowed: chatReactions.reactions.map(buildApiReaction).filter(Boolean),
    };
  }

  return undefined;
}

export function buildApiSendAsPeerId(sendAs: GramJs.SendAsPeer): ApiSendAsPeerId {
  return {
    id: getApiChatIdFromMtpPeer(sendAs.peer),
    isPremium: sendAs.premiumRequired,
  };
}

export function buildApiTopic(forumTopic: GramJs.TypeForumTopic): ApiTopic | undefined {
  if (forumTopic instanceof GramJs.ForumTopicDeleted) {
    return undefined;
  }

  const {
    id,
    my,
    closed,
    pinned,
    hidden,
    short,
    date,
    title,
    iconColor,
    iconEmojiId,
    topMessage,
    unreadCount,
    unreadMentionsCount,
    unreadReactionsCount,
    fromId,
    notifySettings: {
      silent, muteUntil,
    },
  } = forumTopic;

  return {
    id,
    isClosed: closed,
    isPinned: pinned,
    isHidden: hidden,
    isOwner: my,
    isMin: short,
    date,
    title,
    iconColor,
    iconEmojiId: iconEmojiId?.toString(),
    lastMessageId: topMessage,
    unreadCount,
    unreadMentionsCount,
    unreadReactionsCount,
    fromId: getApiChatIdFromMtpPeer(fromId),
    isMuted: silent || (typeof muteUntil === 'number' ? getServerTime() < muteUntil : undefined),
    muteUntil,
  };
}

export function buildApiChatlistInvite(
  invite: GramJs.chatlists.TypeChatlistInvite | undefined, slug: string,
): ApiChatlistInvite | undefined {
  if (invite instanceof GramJs.chatlists.ChatlistInvite) {
    return {
      slug,
      title: invite.title,
      emoticon: invite.emoticon,
      peerIds: invite.peers.map(getApiChatIdFromMtpPeer).filter(Boolean),
    };
  }

  if (invite instanceof GramJs.chatlists.ChatlistInviteAlready) {
    return {
      slug,
      folderId: invite.filterId,
      missingPeerIds: invite.missingPeers.map(getApiChatIdFromMtpPeer).filter(Boolean),
      alreadyPeerIds: invite.alreadyPeers.map(getApiChatIdFromMtpPeer).filter(Boolean),
    };
  }

  return undefined;
}

export function buildApiChatlistExportedInvite(
  invite: GramJs.TypeExportedChatlistInvite | undefined,
): ApiChatlistExportedInvite | undefined {
  if (!(invite instanceof GramJs.ExportedChatlistInvite)) return undefined;

  const {
    title,
    url,
    peers,
  } = invite;

  return {
    title,
    url,
    peerIds: peers.map(getApiChatIdFromMtpPeer).filter(Boolean),
  };
}
