import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiBirthday,
  ApiPeerSettings,
  ApiStarsRating,
  ApiUser,
  ApiUserFullInfo,
  ApiUserStatus,
  ApiUserType,
} from '../../types';

import { toJSNumber } from '../../../util/numbers';
import { addDocumentToLocalDb, addSavedMusicRepairInfo } from '../helpers/localDb';
import { buildApiBotInfo } from './bots';
import { buildApiBusinessIntro, buildApiBusinessLocation, buildApiBusinessWorkHours } from './business';
import {
  buildApiFormattedText, buildApiPhoto, buildApiUsernames,
} from './common';
import { buildApiDisallowedGiftsSettings } from './gifts';
import { omitVirtualClassFields } from './helpers';
import { buildApiAudioFromDocument } from './media';
import {
  buildApiBotVerification,
  buildApiEmojiStatus,
  buildApiPeerColor,
  buildApiPeerId,
  buildApiProfileTab,
  buildAvatarPhotoId,
} from './peers';
import { buildApiWalletCard } from './wallet';

export function buildApiUserFullInfo(mtpUserFull: GramJs.users.UserFull): ApiUserFullInfo {
  const {
    fullUser: {
      about, commonChatsCount, pinnedMsgId, botInfo, blocked,
      profilePhoto, voiceMessagesForbidden, hasScheduled,
      fallbackPhoto, personalPhoto, translationsDisabled, storiesPinnedAvailable,
      contactRequirePremium, businessWorkHours, businessLocation, businessIntro,
      birthday, personalChannelId, personalChannelMessage, sponsoredEnabled, stargiftsCount, botVerification,
      botCanManageEmojiStatus, settings, sendPaidMessagesStars, displayGiftsButton, disallowedGifts,
      starsRating, starsMyPendingRating, starsMyPendingRatingDate, mainTab, savedMusic, note,
      noforwardsMyEnabled, noforwardsPeerEnabled, unofficialSecurityRisk, privateForwardName,
      ttlPeriod, botManagerId, walletCard,
    },
    users,
  } = mtpUserFull;

  const userId = buildApiPeerId(users[0].id, 'user');

  return {
    bio: about,
    ttlPeriod,
    commonChatsCount,
    pinnedMessageId: pinnedMsgId,
    isBlocked: Boolean(blocked),
    noVoiceMessages: voiceMessagesForbidden,
    hasPinnedStories: Boolean(storiesPinnedAvailable),
    isTranslationDisabled: translationsDisabled,
    profilePhoto: profilePhoto instanceof GramJs.Photo ? buildApiPhoto(profilePhoto) : undefined,
    fallbackPhoto: fallbackPhoto instanceof GramJs.Photo ? buildApiPhoto(fallbackPhoto) : undefined,
    personalPhoto: personalPhoto instanceof GramJs.Photo ? buildApiPhoto(personalPhoto) : undefined,
    botInfo: botInfo && buildApiBotInfo(botInfo, userId),
    isContactRequirePremium: contactRequirePremium,
    shouldDisplayGiftsButton: displayGiftsButton,
    disallowedGifts: disallowedGifts && buildApiDisallowedGiftsSettings(disallowedGifts),
    birthday: birthday && buildApiBirthday(birthday),
    businessLocation: businessLocation && buildApiBusinessLocation(businessLocation),
    businessWorkHours: businessWorkHours && buildApiBusinessWorkHours(businessWorkHours),
    businessIntro: businessIntro && buildApiBusinessIntro(businessIntro),
    personalChannelId: personalChannelId !== undefined
      ? buildApiPeerId(personalChannelId, 'channel') : undefined,
    personalChannelMessageId: personalChannelMessage,
    privateForwardName,
    botVerification: botVerification && buildApiBotVerification(botVerification),
    areAdsEnabled: sponsoredEnabled,
    starGiftCount: stargiftsCount,
    starsRating: starsRating && buildApiStarsRating(starsRating),
    starsMyPendingRating: starsMyPendingRating && buildApiStarsRating(starsMyPendingRating),
    starsMyPendingRatingDate,
    isBotCanManageEmojiStatus: botCanManageEmojiStatus,
    hasScheduledMessages: hasScheduled,
    paidMessagesStars: toJSNumber(sendPaidMessagesStars),
    settings: buildApiPeerSettings(settings),
    mainTab: mainTab && buildApiProfileTab(mainTab),
    savedMusic: savedMusic && buildApiSavedMusic(savedMusic, userId),
    note: note && buildApiFormattedText(note),
    noForwardsMyEnabled: noforwardsMyEnabled,
    noForwardsPeerEnabled: noforwardsPeerEnabled,
    isUnofficialSecurityRisk: unofficialSecurityRisk,
    botManagerId: botManagerId !== undefined ? buildApiPeerId(botManagerId, 'user') : undefined,
    walletCard: walletCard && buildApiWalletCard(walletCard),
  };
}

export function buildApiPeerSettings({
  autoarchived,
  reportSpam,
  addContact,
  blockContact,
  registrationMonth,
  phoneCountry,
  nameChangeDate,
  photoChangeDate,
  chargePaidMessageStars,
}: GramJs.PeerSettings): ApiPeerSettings {
  return {
    isAutoArchived: Boolean(autoarchived),
    canReportSpam: Boolean(reportSpam),
    canAddContact: Boolean(addContact),
    canBlockContact: Boolean(blockContact),
    registrationMonth,
    phoneCountry,
    nameChangeDate,
    photoChangeDate,
    chargedPaidMessageStars: toJSNumber(chargePaidMessageStars),
  };
}

export function buildApiUser(mtpUser: GramJs.TypeUser): ApiUser | undefined {
  if (!(mtpUser instanceof GramJs.User)) {
    return undefined;
  }

  const {
    id, firstName, lastName, fake, scam, support, closeFriend, storiesUnavailable,
    botActiveUsers, botVerificationIcon, botInlinePlaceholder, botAttachMenu, botCanEdit,
    sendPaidMessagesStars, profileColor, botForumView, botForumCanManageTopics, botGuestchat,
    botGuard, botCanManageBots,
  } = mtpUser;
  const storiesMaxId = mtpUser.storiesMaxId?.maxId;
  const hasVideoAvatar = mtpUser.photo instanceof GramJs.UserProfilePhoto ? Boolean(mtpUser.photo.hasVideo) : undefined;
  const avatarPhotoId = mtpUser.photo && buildAvatarPhotoId(mtpUser.photo);
  const userType = buildApiUserType(mtpUser);
  const usernames = buildApiUsernames(mtpUser);
  const hasUsername = usernames?.some((username) => username.isActive);
  const emojiStatus = mtpUser.emojiStatus ? buildApiEmojiStatus(mtpUser.emojiStatus) : undefined;

  return {
    id: buildApiPeerId(id, 'user'),
    isMin: Boolean(mtpUser.min),
    fakeType: scam ? 'scam' : (fake ? 'fake' : undefined),
    isSelf: mtpUser.self || undefined,
    isPremium: Boolean(mtpUser.premium),
    isVerified: mtpUser.verified || undefined,
    isCloseFriend: closeFriend || undefined,
    isSupport: support || undefined,
    isContact: mtpUser.contact || mtpUser.mutualContact || undefined,
    type: userType,
    firstName,
    lastName,
    hasMainMiniApp: Boolean(mtpUser.botHasMainApp),
    canEditBot: botCanEdit,
    canBotBeInvitedToGroup: userType === 'userTypeBot' ? !mtpUser.botNochats : undefined,
    usernames,
    hasUsername,
    phoneNumber: mtpUser.phone || '',
    noStatus: !mtpUser.status,
    ...(mtpUser.accessHash && { accessHash: String(mtpUser.accessHash) }),
    avatarPhotoId,
    emojiStatus,
    hasVideoAvatar,
    areStoriesHidden: Boolean(mtpUser.storiesHidden),
    maxStoryId: storiesMaxId,
    hasStories: Boolean(storiesMaxId) && !storiesUnavailable,
    botPlaceholder: botInlinePlaceholder || undefined,
    isAttachBot: botAttachMenu || undefined,
    botActiveUsers,
    botVerificationIconId: botVerificationIcon?.toString(),
    color: mtpUser.color && buildApiPeerColor(mtpUser.color),
    profileColor: profileColor && buildApiPeerColor(profileColor),
    paidMessagesStars: toJSNumber(sendPaidMessagesStars),
    isBotForum: botForumView,
    canManageBotForumTopics: botForumCanManageTopics,
    canManageBots: botCanManageBots,
    isGuestChatBot: botGuestchat,
    isGuardBot: botGuard || undefined,
  };
}

function buildApiUserType(user: GramJs.User): ApiUserType {
  if (user.bot) {
    return 'userTypeBot';
  }
  if (user.deleted) {
    return 'userTypeDeleted';
  }

  return 'userTypeRegular';
}

export function buildApiUserStatus(mtpStatus?: GramJs.TypeUserStatus): ApiUserStatus {
  if (!mtpStatus || mtpStatus instanceof GramJs.UserStatusEmpty) {
    return { type: 'userStatusEmpty' };
  } else if (mtpStatus instanceof GramJs.UserStatusOnline) {
    return { type: 'userStatusOnline', expires: mtpStatus.expires };
  } else if (mtpStatus instanceof GramJs.UserStatusOffline) {
    return { type: 'userStatusOffline', wasOnline: mtpStatus.wasOnline };
  } else if (mtpStatus instanceof GramJs.UserStatusRecently) {
    return { type: 'userStatusRecently', isReadDateRestrictedByMe: mtpStatus.byMe };
  } else if (mtpStatus instanceof GramJs.UserStatusLastWeek) {
    return { type: 'userStatusLastWeek', isReadDateRestrictedByMe: mtpStatus.byMe };
  } else {
    return { type: 'userStatusLastMonth', isReadDateRestrictedByMe: mtpStatus.byMe };
  }
}

export function buildApiUserStatuses(mtpUsers: GramJs.TypeUser[]) {
  const userStatusesById: Record<string, ApiUserStatus> = {};
  mtpUsers.forEach((mtpUser) => {
    if ('status' in mtpUser) {
      const userId = buildApiPeerId(mtpUser.id, 'user');
      userStatusesById[userId] = buildApiUserStatus(mtpUser.status);
    }
  });

  return userStatusesById;
}

export function buildApiBirthday(birthday: GramJs.TypeBirthday): ApiBirthday {
  return omitVirtualClassFields(birthday);
}

export function buildApiStarsRating(starsRating: GramJs.StarsRating): ApiStarsRating {
  return {
    level: starsRating.level,
    currentLevelStars: toJSNumber(starsRating.currentLevelStars),
    stars: toJSNumber(starsRating.stars),
    nextLevelStars: toJSNumber(starsRating.nextLevelStars),
  };
}

function buildApiSavedMusic(document: GramJs.TypeDocument, peerId: string) {
  if (!(document instanceof GramJs.Document)) {
    return undefined;
  }

  addDocumentToLocalDb(addSavedMusicRepairInfo(document, peerId));

  return buildApiAudioFromDocument(document);
}
