import type { API_CHAT_TYPES } from '../../config';
import type { ApiBotInfo } from './bots';
import type { ApiBusinessIntro, ApiBusinessLocation, ApiBusinessWorkHours } from './business';
import type { ApiPeerColor } from './chats';
import type { ApiDocument, ApiPhoto } from './messages';
import type { ApiBotVerification } from './misc';
import type { ApiSavedStarGift } from './payments';

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
  color?: ApiPeerColor;
  canEditBot?: boolean;
  hasMainMiniApp?: boolean;
  botActiveUsers?: number;
  botVerificationIconId?: string;
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
  premiumGifts?: ApiPremiumGiftOption[];
  isTranslationDisabled?: true;
  areAdsEnabled?: boolean;
  hasPinnedStories?: boolean;
  isContactRequirePremium?: boolean;
  birthday?: ApiBirthday;
  personalChannelId?: string;
  personalChannelMessageId?: number;
  businessLocation?: ApiBusinessLocation;
  businessWorkHours?: ApiBusinessWorkHours;
  businessIntro?: ApiBusinessIntro;
  starGiftCount?: number;
  isBotCanManageEmojiStatus?: boolean;
  isBotAccessEmojiGranted?: boolean;
  hasScheduledMessages?: boolean;
  botVerification?: ApiBotVerification;
}

export type ApiFakeType = 'fake' | 'scam';

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

type ApiAttachBotForMenu = {
  isForAttachMenu: true;
  attachMenuPeerTypes: ApiAttachMenuPeerType[];
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

export interface ApiPremiumGiftOption {
  months: number;
  currency: string;
  amount: number;
  botUrl: string;
}

export type ApiEmojiStatusType = ApiEmojiStatus | ApiEmojiStatusCollectible;

export interface ApiEmojiStatus {
  type: 'regular';
  documentId: string;
  until?: number;
}

export interface ApiEmojiStatusCollectible {
  type: 'collectible';
  collectibleId: string;
  documentId: string;
  title: string;
  slug: string;
  patternDocumentId: string;
  centerColor: string;
  edgeColor: string;
  patternColor: string;
  textColor: string;
  until?: number;
}

export interface ApiBirthday {
  day: number;
  month: number;
  year?: number;
}
