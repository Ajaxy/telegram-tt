import { Api as GramJs } from '../../../lib/gramjs';
import type { Entity } from '../../../lib/gramjs/types';

import type {
  ApiBotCommand,
  ApiChat,
  ApiChatAdminRights,
  ApiChatBannedRights,
  ApiChatFolder,
  ApiChatInviteImporter,
  ApiChatInviteInfo,
  ApiChatlistExportedInvite,
  ApiChatlistInvite,
  ApiChatMember,
  ApiChatReactions,
  ApiExportedInvite,
  ApiMissingInvitedUser,
  ApiRestrictionReason,
  ApiSendAsPeerId,
  ApiSponsoredMessageReportResult,
  ApiSponsoredPeer,
  ApiStarsSubscriptionPricing,
} from '../../types';

import { pickTruthy } from '../../../util/iteratees';
import { toJSNumber } from '../../../util/numbers';
import { getServerTimeOffset } from '../../../util/serverTime';
import { addPhotoToLocalDb, addUserToLocalDb } from '../helpers/localDb';
import { serializeBytes } from '../helpers/misc';
import {
  buildApiFormattedText, buildApiPhoto, buildApiUsernames,
} from './common';
import { omitVirtualClassFields } from './helpers';
import { buildApiRestrictionReasons } from './misc';
import {
  buildApiBotVerification,
  buildApiEmojiStatus,
  buildApiPeerColor,
  buildApiPeerId,
  buildAvatarPhotoId,
  getApiChatIdFromMtpPeer,
  isMtpPeerChat,
  isMtpPeerUser,
} from './peers';
import { buildApiReaction } from './reactions';

type PeerEntityApiChatFields = Omit<ApiChat, (
  'id' | 'type' | 'title' |
  'lastReadOutboxMessageId' | 'lastReadInboxMessageId' |
  'unreadCount' | 'unreadMentionsCount' | 'isMuted'
)>;

function buildApiChatFieldsFromPeerEntity(
  peerEntity: Entity,
  isSupport = false,
): PeerEntityApiChatFields {
  const user = peerEntity instanceof GramJs.User ? peerEntity : undefined;
  const channel = peerEntity instanceof GramJs.Channel ? peerEntity : undefined;

  const userOrChannel = user || channel;

  // Shared fields
  const isMin = Boolean('min' in peerEntity && peerEntity.min);
  const accessHash = ('accessHash' in peerEntity) ? String(peerEntity.accessHash) : undefined;
  const hasVideoAvatar = 'photo' in peerEntity && peerEntity.photo && 'hasVideo' in peerEntity.photo
    && peerEntity.photo.hasVideo;
  const avatarPhotoId = ('photo' in peerEntity) && peerEntity.photo ? buildAvatarPhotoId(peerEntity.photo) : undefined;

  const usernames = buildApiUsernames(peerEntity);
  const hasUsername = usernames?.some((username) => username.isActive);

  // Chat and channel shared fields
  const isCallActive = 'callActive' in peerEntity && peerEntity.callActive;
  const isCallNotEmpty = 'callNotEmpty' in peerEntity && peerEntity.callNotEmpty;
  const creationDate = 'date' in peerEntity ? peerEntity.date : undefined;
  const membersCount = 'participantsCount' in peerEntity ? peerEntity.participantsCount : undefined;
  const isProtected = 'noforwards' in peerEntity && peerEntity.noforwards;
  const isCreator = 'creator' in peerEntity && peerEntity.creator;

  // User and channel shared fields
  const isScam = userOrChannel?.scam;
  const isFake = userOrChannel?.fake;
  const areStoriesHidden = userOrChannel?.storiesHidden;
  const maxStoryId = userOrChannel?.storiesMaxId;
  const botVerificationIconId = userOrChannel?.botVerificationIcon?.toString();
  const storiesUnavailable = userOrChannel?.storiesUnavailable;
  const color = userOrChannel?.color ? buildApiPeerColor(userOrChannel.color) : undefined;
  const profileColor = userOrChannel?.profileColor ? buildApiPeerColor(userOrChannel.profileColor) : undefined;
  const emojiStatus = userOrChannel?.emojiStatus ? buildApiEmojiStatus(userOrChannel.emojiStatus) : undefined;
  const paidMessagesStars = userOrChannel?.sendPaidMessagesStars;
  const isVerified = userOrChannel?.verified;

  return {
    isMin,
    isLinkedInDiscussion: channel?.hasLink,
    areSignaturesShown: channel?.signatures,
    areProfilesShown: channel?.signatureProfiles,
    usernames,
    accessHash,
    hasVideoAvatar,
    avatarPhotoId,
    isVerified,
    isCallActive,
    isCallNotEmpty,
    creationDate,
    hasUsername,
    ...(membersCount !== undefined && { membersCount }),
    isProtected,
    isSupport: isSupport || undefined,
    isCreator,
    fakeType: isScam ? 'scam' : (isFake ? 'fake' : undefined),
    color,
    profileColor,
    isJoinToSend: channel?.joinToSend,
    isJoinRequest: channel?.joinRequest,
    isForum: channel?.forum,
    isMonoforum: channel?.monoforum,
    linkedMonoforumId: channel?.linkedMonoforumId !== undefined
      ? buildApiPeerId(channel.linkedMonoforumId, 'channel') : undefined,
    areChannelMessagesAllowed: channel?.broadcastMessagesAllowed,
    areStoriesHidden,
    maxStoryId,
    hasStories: Boolean(maxStoryId) && !storiesUnavailable,
    emojiStatus,
    boostLevel: channel?.level,
    botVerificationIconId,
    hasGeo: channel?.hasGeo,
    subscriptionUntil: channel?.subscriptionUntilDate,
    paidMessagesStars: toJSNumber(paidMessagesStars),
    level: channel?.level,
    hasAutoTranslation: channel?.autotranslation,
    withForumTabs: channel?.forumTabs,

    ...buildApiChatPermissions(peerEntity),
    ...buildApiChatRestrictions(peerEntity),
    ...buildApiChatMigrationInfo(peerEntity),
  };
}

export function buildApiChatFromDialog(
  dialog: GramJs.Dialog,
  peerEntity: GramJs.TypeUser | GramJs.TypeChat,
): ApiChat {
  const {
    peer, folderId, unreadMark, unreadCount, unreadMentionsCount, unreadReactionsCount,
    readOutboxMaxId, readInboxMaxId, draft, viewForumAsMessages,
  } = dialog;

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
    ...(unreadMark && { hasUnreadMark: true }),
    ...(draft instanceof GramJs.DraftMessage && { draftDate: draft.date }),
    ...(viewForumAsMessages && { isForumAsMessages: true }),
    ...buildApiChatFieldsFromPeerEntity(peerEntity),
  };
}

export function buildApiChatFromSavedDialog(
  dialog: GramJs.SavedDialog,
  peerEntity: GramJs.TypeUser | GramJs.TypeChat,
): ApiChat {
  const { peer } = dialog;

  return {
    id: getApiChatIdFromMtpPeer(peer),
    type: getApiChatTypeFromPeerEntity(peerEntity),
    title: getApiChatTitleFromMtpPeer(peer, peerEntity),
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

function buildApiChatRestrictions(peerEntity: Entity): {
  isNotJoined?: boolean;
  isForbidden?: boolean;
  isRestricted?: boolean;
  restrictionReasons?: ApiRestrictionReason[];
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

  if ('restricted' in peerEntity && !peerEntity.min) {
    const restrictionReasons = buildApiRestrictionReasons(peerEntity.restrictionReason);

    Object.assign(restrictions, {
      restrictionReasons,
    });
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

function buildApiChatMigrationInfo(peerEntity: Entity): {
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
  if (isMtpPeerUser(peer)) {
    return `user${peer.userId.toString()}`;
  } else if (isMtpPeerChat(peer)) {
    return `chat${peer.chatId.toString()}`;
  } else {
    return `chat${peer.channelId.toString()}`;
  }
}

export function getApiChatTitleFromMtpPeer(peer: GramJs.TypePeer, peerEntity: Entity) {
  if (isMtpPeerUser(peer)) {
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

export function buildChatMember(
  member: GramJs.TypeChatParticipant | GramJs.TypeChannelParticipant,
): ApiChatMember | undefined {
  const userId = (member instanceof GramJs.ChannelParticipantBanned || member instanceof GramJs.ChannelParticipantLeft)
    ? getApiChatIdFromMtpPeer(member.peer)
    : buildApiPeerId(member.userId, 'user');

  return {
    userId,
    inviterId: 'inviterId' in member && member.inviterId
      ? buildApiPeerId(member.inviterId, 'user')
      : undefined,
    joinedDate: 'date' in member ? member.date : undefined,
    kickedByUserId: 'kickedBy' in member && member.kickedBy ? buildApiPeerId(member.kickedBy, 'user') : undefined,
    promotedByUserId: 'promotedBy' in member && member.promotedBy
      ? buildApiPeerId(member.promotedBy, 'user')
      : undefined,
    bannedRights: 'bannedRights' in member ? omitVirtualClassFields(member.bannedRights) : undefined,
    adminRights: 'adminRights' in member ? omitVirtualClassFields(member.adminRights) : undefined,
    customTitle: 'rank' in member ? member.rank : undefined,
    isViaRequest: 'viaRequest' in member ? member.viaRequest : undefined,
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
        'id', 'emoticon',
      ]),
      excludedChatIds: [],
      includedChatIds: filter.includePeers.map(getApiChatIdFromMtpPeer).filter(Boolean),
      pinnedChatIds: filter.pinnedPeers.map(getApiChatIdFromMtpPeer).filter(Boolean),
      hasMyInvites: filter.hasMyInvites,
      isChatList: true,
      noTitleAnimations: filter.titleNoanimate,
      color: filter.color,
      title: buildApiFormattedText(filter.title),
    };
  }

  return {
    ...pickTruthy(filter, [
      'id', 'emoticon', 'contacts', 'nonContacts', 'groups', 'bots',
      'excludeMuted', 'excludeRead', 'excludeArchived',
    ]),
    channels: filter.broadcasts,
    pinnedChatIds: filter.pinnedPeers.map(getApiChatIdFromMtpPeer).filter(Boolean),
    includedChatIds: filter.includePeers.map(getApiChatIdFromMtpPeer).filter(Boolean),
    excludedChatIds: filter.excludePeers.map(getApiChatIdFromMtpPeer).filter(Boolean),
    color: filter.color,
    title: buildApiFormattedText(filter.title),
    noTitleAnimations: filter.titleNoanimate,
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
      allowed: chatReactions.reactions.map((r) => buildApiReaction(r)).filter(Boolean),
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

export function buildApiChatlistInvite(
  invite: GramJs.chatlists.TypeChatlistInvite | undefined, slug: string,
): ApiChatlistInvite | undefined {
  if (invite instanceof GramJs.chatlists.ChatlistInvite) {
    return {
      slug,
      title: buildApiFormattedText(invite.title),
      noTitleAnimations: invite.titleNoanimate,
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

export function buildApiMissingInvitedUser(
  user: GramJs.TypeMissingInvitee,
): ApiMissingInvitedUser {
  return {
    id: user.userId.toString(),
    isRequiringPremiumToMessage: user.premiumRequiredForPm,
    isRequiringPremiumToInvite: user.premiumWouldAllowInvite,
  };
}

export function buildApiSponsoredMessageReportResult(
  result: GramJs.channels.TypeSponsoredMessageReportResult,
): ApiSponsoredMessageReportResult {
  if (result instanceof GramJs.channels.SponsoredMessageReportResultReported) {
    return {
      type: 'reported',
    };
  }

  if (result instanceof GramJs.channels.SponsoredMessageReportResultAdsHidden) {
    return {
      type: 'hidden',
    };
  }

  const title = result.title;
  const options = result.options.map((option) => ({
    text: option.text,
    option: serializeBytes(option.option),
  }));

  return {
    type: 'selectOption',
    title,
    options,
  };
}

export function buildApiChatInviteInfo(invite: GramJs.ChatInvite): ApiChatInviteInfo {
  const {
    color, participants, participantsCount, photo, title, about, scam, fake, verified, megagroup, channel, broadcast,
    requestNeeded, subscriptionFormId, subscriptionPricing, canRefulfillSubscription, botVerification,
  } = invite;

  let apiPhoto;
  if (photo instanceof GramJs.Photo) {
    addPhotoToLocalDb(photo);
    apiPhoto = buildApiPhoto(photo);
  }

  participants?.forEach(addUserToLocalDb);

  return {
    title,
    about,
    isFake: fake,
    isScam: scam,
    isVerified: verified,
    isSuperGroup: megagroup,
    isPublic: invite.public,
    participantsCount,
    color,
    isChannel: channel,
    isBroadcast: broadcast,
    isRequestNeeded: requestNeeded,
    photo: apiPhoto,
    subscriptionFormId: subscriptionFormId?.toString(),
    subscriptionPricing: subscriptionPricing && buildApiStarsSubscriptionPricing(subscriptionPricing),
    canRefulfillSubscription,
    participantIds: participants?.map((participant) => buildApiPeerId(participant.id, 'user')).filter(Boolean),
    botVerification: botVerification && buildApiBotVerification(botVerification),
  };
}

export function buildApiStarsSubscriptionPricing(
  pricing: GramJs.StarsSubscriptionPricing,
): ApiStarsSubscriptionPricing {
  return {
    period: pricing.period,
    amount: toJSNumber(pricing.amount),
  };
}

export function buildApiSponsoredPeer(sponsoredPeer: GramJs.SponsoredPeer): ApiSponsoredPeer {
  const {
    peer, randomId, additionalInfo, sponsorInfo,
  } = sponsoredPeer;

  return {
    peerId: getApiChatIdFromMtpPeer(peer),
    randomId: serializeBytes(randomId),
    additionalInfo,
    sponsorInfo,
  };
}
