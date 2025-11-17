import type { API_CHAT_TYPES } from '../../config';
import type { ApiBotInfo } from './bots';
import type { ApiBusinessIntro, ApiBusinessLocation, ApiBusinessWorkHours } from './business';
import type { ApiDocument, ApiFormattedText, ApiPhoto } from './messages';
import type {
  ApiBotVerification,
  ApiEmojiStatusType,
  ApiFakeType,
  ApiPeerSettings,
  ApiProfileTab,
  ApiTypePeerColor,
} from './peers';
import type { ApiSavedStarGift, ApiStarsRating } from './stars';

export interface ApiUser {
  id: string;
  isMin: boolean;
  isSelf?: true;
  isVerified?: true;
  isPremium?: boolean;
  isCloseFriend?: boolean;
  isContact?: true;
  isSupport?: true;
  type: ApiUserType;
  firstName?: string;
  lastName?: string;
  noStatus?: boolean;
  usernames?: ApiUsername[];
  hasUsername?: boolean;
  phoneNumber: string;
  accessHash?: string;
  hasVideoAvatar?: boolean;
  avatarPhotoId?: string;
  botPlaceholder?: string;
  canBeInvitedToGroup?: boolean;
  fakeType?: ApiFakeType;
  isAttachBot?: boolean;
  emojiStatus?: ApiEmojiStatusType;
  areStoriesHidden?: boolean;
  hasStories?: boolean;
  hasUnreadStories?: boolean;
  maxStoryId?: number;
  color?: ApiTypePeerColor;
  profileColor?: ApiTypePeerColor;
  canEditBot?: boolean;
  hasMainMiniApp?: boolean;
  botActiveUsers?: number;
  botVerificationIconId?: string;
  paidMessagesStars?: number;
  isBotForum?: boolean;
}

export interface ApiUserFullInfo {
  isBlocked?: boolean;
  bio?: string;
  commonChatsCount?: number;
  pinnedMessageId?: number;
  botInfo?: ApiBotInfo;
  profilePhoto?: ApiPhoto;
  fallbackPhoto?: ApiPhoto;
  personalPhoto?: ApiPhoto;
  noVoiceMessages?: boolean;
  isTranslationDisabled?: true;
  areAdsEnabled?: boolean;
  hasPinnedStories?: boolean;
  isContactRequirePremium?: boolean;
  shouldDisplayGiftsButton?: boolean;
  disallowedGifts?: ApiDisallowedGifts;
  birthday?: ApiBirthday;
  personalChannelId?: string;
  personalChannelMessageId?: number;
  businessLocation?: ApiBusinessLocation;
  businessWorkHours?: ApiBusinessWorkHours;
  businessIntro?: ApiBusinessIntro;
  starGiftCount?: number;
  starsRating?: ApiStarsRating;
  starsMyPendingRating?: ApiStarsRating;
  starsMyPendingRatingDate?: number;
  isBotCanManageEmojiStatus?: boolean;
  isBotAccessEmojiGranted?: boolean;
  hasScheduledMessages?: boolean;
  botVerification?: ApiBotVerification;
  paidMessagesStars?: number;
  settings?: ApiPeerSettings;
  mainTab?: ApiProfileTab;
  note?: ApiFormattedText;
}

export type ApiUserType = 'userTypeBot' | 'userTypeRegular' | 'userTypeDeleted' | 'userTypeUnknown';

export interface ApiUserStatus {
  type: (
    'userStatusEmpty' | 'userStatusLastMonth' | 'userStatusLastWeek' |
    'userStatusOffline' | 'userStatusOnline' | 'userStatusRecently'
  );
  wasOnline?: number;
  expires?: number;
  isReadDateRestrictedByMe?: boolean;
  isReadDateRestricted?: boolean;
}

export interface ApiUserCommonChats {
  ids: string[];
  maxId?: string;
  isFullyLoaded: boolean;
}

export interface ApiSavedGifts {
  gifts: ApiSavedStarGift[];
  nextOffset?: string;
}

export interface ApiUsername {
  username: string;
  isActive?: boolean;
  isEditable?: boolean;
}

export type ApiChatType = typeof API_CHAT_TYPES[number];
export type ApiAttachMenuPeerType = 'self' | ApiChatType;

export type ApiInlineQueryPeerType = 'self' | 'supergroups' | ApiChatType;

type ApiAttachBotForMenu = {
  isForAttachMenu: true;
  attachMenuPeerTypes?: ApiAttachMenuPeerType[];
};

type ApiAttachBotBase = {
  id: string;
  shouldRequestWriteAccess?: boolean;
  shortName: string;
  isForSideMenu?: true;
  isDisclaimerNeeded?: boolean;
  icons: ApiAttachBotIcon[];
  isInactive?: boolean;
};

export type ApiAttachBot = OptionalCombine<ApiAttachBotBase, ApiAttachBotForMenu>;

export interface ApiAttachBotIcon {
  name: string;
  document: ApiDocument;
}

export interface ApiBirthday {
  day: number;
  month: number;
  year?: number;
}

export interface ApiDisallowedGifts {
  shouldDisallowUnlimitedStarGifts?: boolean;
  shouldDisallowLimitedStarGifts?: boolean;
  shouldDisallowUniqueStarGifts?: boolean;
  shouldDisallowPremiumGifts?: boolean;
}
