import { Api as GramJs } from '../../../lib/gramjs';
import {
  ApiChat,
  ApiChatAdminRights,
  ApiChatBannedRights,
  ApiChatFolder,
  ApiChatMember,
  ApiRestrictionReason,
} from '../../types';
import { pick, pickTruthy } from '../../../util/iteratees';
import {
  isInputPeerChannel, isInputPeerChat, isInputPeerUser, isPeerChat, isPeerUser,
} from './peers';
import { omitVirtualClassFields } from './helpers';

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
  const accessHash = ('accessHash' in peerEntity) && String(peerEntity.accessHash);
  const avatarHash = ('photo' in peerEntity) && peerEntity.photo && buildAvatarHash(peerEntity.photo);
  const isSignaturesShown = Boolean('signatures' in peerEntity && peerEntity.signatures);
  const hasPrivateLink = Boolean('hasLink' in peerEntity && peerEntity.hasLink);

  return {
    isMin,
    hasPrivateLink,
    isSignaturesShown,
    ...(accessHash && { accessHash }),
    ...(avatarHash && { avatarHash }),
    ...(
      (peerEntity instanceof GramJs.Channel || peerEntity instanceof GramJs.User)
      && { username: peerEntity.username }
    ),
    ...(('verified' in peerEntity) && { isVerified: peerEntity.verified }),
    ...(('callActive' in peerEntity) && { isCallActive: peerEntity.callActive }),
    ...(('callNotEmpty' in peerEntity) && { isCallNotEmpty: peerEntity.callNotEmpty }),
    ...((peerEntity instanceof GramJs.Chat || peerEntity instanceof GramJs.Channel) && {
      ...(peerEntity.participantsCount && { membersCount: peerEntity.participantsCount }),
      joinDate: peerEntity.date,
    }),
    ...(isSupport && { isSupport: true }),
    ...buildApiChatPermissions(peerEntity),
    ...(('creator' in peerEntity) && { isCreator: peerEntity.creator }),
    ...buildApiChatRestrictions(peerEntity),
    ...buildApiChatMigrationInfo(peerEntity),
  };
}

export function buildApiChatFromDialog(
  dialog: GramJs.Dialog,
  peerEntity: GramJs.TypeUser | GramJs.TypeChat,
  serverTimeOffset: number,
): ApiChat {
  const {
    peer, folderId, unreadMark, unreadCount, unreadMentionsCount, notifySettings: { silent, muteUntil },
    readOutboxMaxId, readInboxMaxId,
  } = dialog;
  const isMuted = silent || (typeof muteUntil === 'number' && Date.now() + serverTimeOffset * 1000 < muteUntil * 1000);

  return {
    id: getApiChatIdFromMtpPeer(peer),
    ...(folderId && { folderId }),
    type: getApiChatTypeFromPeerEntity(peerEntity),
    title: getApiChatTitleFromMtpPeer(peer, peerEntity),
    lastReadOutboxMessageId: readOutboxMaxId,
    lastReadInboxMessageId: readInboxMaxId,
    unreadCount,
    unreadMentionsCount,
    isMuted,
    ...(unreadMark && { hasUnreadMark: true }),
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
    adminRights: omitVirtualClassFields(peerEntity.adminRights),
    currentUserBannedRights: peerEntity instanceof GramJs.Channel
      ? omitVirtualClassFields(peerEntity.bannedRights)
      : undefined,
    defaultBannedRights: omitVirtualClassFields(peerEntity.defaultBannedRights),
  };
}

function buildApiChatRestrictions(peerEntity: GramJs.TypeUser | GramJs.TypeChat): {
  isNotJoined?: boolean;
  isRestricted?: boolean;
  restrictionReason?: ApiRestrictionReason;
} {
  if (peerEntity instanceof GramJs.ChatForbidden || peerEntity instanceof GramJs.ChannelForbidden) {
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
      isRestricted: peerEntity.kicked,
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
    chatId: number;
    accessHash?: string;
  };
} {
  if (
    peerEntity instanceof GramJs.Chat
    && peerEntity.migratedTo
    && !(peerEntity.migratedTo instanceof GramJs.InputChannelEmpty)
  ) {
    return {
      migratedTo: {
        chatId: getApiChatIdFromMtpPeer(peerEntity.migratedTo),
        ...(peerEntity.migratedTo instanceof GramJs.InputChannel && {
          accessHash: peerEntity.migratedTo.accessHash.toString(),
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
  withForbidden = false,
): ApiChat | undefined {
  if (!(
    preview instanceof GramJs.Chat
    || preview instanceof GramJs.Channel
    || preview instanceof GramJs.User
    || (
      withForbidden
      && (
        preview instanceof GramJs.ChatForbidden
        || preview instanceof GramJs.ChannelForbidden
      )
    )
  )) {
    return undefined;
  }

  return {
    id: preview instanceof GramJs.User ? preview.id : -preview.id,
    type: getApiChatTypeFromPeerEntity(preview),
    title: preview instanceof GramJs.User ? getUserName(preview) : preview.title,
    ...buildApiChatFieldsFromPeerEntity(preview, isSupport),
  };
}

export function getApiChatIdFromMtpPeer(peer: GramJs.TypePeer): number {
  if (isPeerUser(peer)) {
    return peer.userId;
  } else if (isPeerChat(peer)) {
    return -peer.chatId;
  } else {
    return -peer.channelId;
  }
}

export function getApiChatIdFromInputMtpPeer(peer: GramJs.TypeInputPeer): number | undefined {
  if (isInputPeerUser(peer)) {
    return peer.userId;
  } else if (isInputPeerChat(peer)) {
    return -peer.chatId;
  } else if (isInputPeerChannel(peer)) {
    return -peer.channelId;
  }
  return undefined;
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
    : (user.lastName || undefined);
}

export function buildAvatarHash(photo: GramJs.TypeUserProfilePhoto | GramJs.TypeChatPhoto) {
  if ('photoId' in photo) {
    return photo.photoId.toString();
  }

  return undefined;
}

export function buildChatMember(
  member: GramJs.TypeChatParticipant | GramJs.TypeChannelParticipant,
): ApiChatMember | undefined {
  const userId = (member instanceof GramJs.ChannelParticipantBanned || member instanceof GramJs.ChannelParticipantLeft)
    ? getApiChatIdFromMtpPeer(member.peer)
    : member.userId;

  return {
    userId,
    inviterId: 'inviterId' in member ? member.inviterId : undefined,
    joinedDate: 'date' in member ? member.date : undefined,
    kickedByUserId: 'kickedBy' in member ? member.kickedBy : undefined,
    promotedByUserId: 'promotedBy' in member ? member.promotedBy : undefined,
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
    return participants.participants.map(buildChatMember).filter<ApiChatMember>(Boolean as any);
  }
  if (participants instanceof GramJs.channels.ChannelParticipants) {
    return participants.participants.map(buildChatMember).filter<ApiChatMember>(Boolean as any);
  }

  return undefined;
}

export function buildChatTypingStatus(
  update: GramJs.UpdateUserTyping | GramJs.UpdateChatUserTyping | GramJs.UpdateChannelUserTyping,
  serverTimeOffset: number,
) {
  let action: string = '';
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
  }

  return {
    action,
    ...(!(update instanceof GramJs.UpdateUserTyping) && { userId: getApiChatIdFromMtpPeer(update.fromId) }),
    timestamp: Date.now() + serverTimeOffset * 1000,
  };
}

export function buildApiChatFolder(filter: GramJs.DialogFilter): ApiChatFolder {
  return {
    ...pickTruthy(filter, [
      'id', 'title', 'emoticon', 'contacts', 'nonContacts', 'groups', 'bots',
      'excludeMuted', 'excludeRead', 'excludeArchived',
    ]),
    channels: filter.broadcasts,
    pinnedChatIds: filter.pinnedPeers.map(getApiChatIdFromInputMtpPeer).filter<number>(Boolean as any),
    includedChatIds: filter.includePeers.map(getApiChatIdFromInputMtpPeer).filter<number>(Boolean as any),
    excludedChatIds: filter.excludePeers.map(getApiChatIdFromInputMtpPeer).filter<number>(Boolean as any),
  };
}

export function buildApiChatFolderFromSuggested({
  filter, description,
}: {
  filter: GramJs.DialogFilter;
  description: string;
}): ApiChatFolder {
  return {
    ...buildApiChatFolder(filter),
    description,
  };
}
