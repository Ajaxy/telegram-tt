import type { TeactNode } from '../../lib/teact/teact';

import type { CallbackAction } from '../../global/types';
import type { IconName } from '../../types/icons';
import type { RegularLangFnParameters } from '../../util/localization';
import type { ApiDocument, ApiPhoto, ApiReaction } from './messages';
import type { ApiPremiumSection } from './payments';
import type { ApiStarsSubscriptionPricing } from './stars';
import type { ApiUser } from './users';

export interface ApiInitialArgs {
  userAgent: string;
  platform?: string;
  sessionData?: ApiSessionData;
  isTest?: boolean;
  isWebmSupported?: boolean;
  maxBufferSize?: number;
  webAuthToken?: string;
  dcId?: number;
  mockScenario?: string;
  shouldAllowHttpTransport?: boolean;
  shouldForceHttpTransport?: boolean;
  shouldDebugExportedSenders?: boolean;
  langCode: string;
  isTestServerRequested?: boolean;
}

export interface ApiOnProgress {
  (
    progress: number, // Float between 0 and 1.
    ...args: any[]
  ): void;

  isCanceled?: boolean;
}

export interface ApiAttachment {
  blobUrl: string;
  compressedBlobUrl?: string;
  filename: string;
  mimeType: string;
  size: number;
  quick?: {
    width: number;
    height: number;
    duration?: number;
  };
  voice?: {
    duration: number;
    waveform: number[];
  };
  audio?: {
    duration: number;
    title?: string;
    performer?: string;
  };
  previewBlobUrl?: string;

  shouldSendAsFile?: true;
  shouldSendAsSpoiler?: true;

  uniqueId?: string;
  ttlSeconds?: number;
}

export interface ApiWallpaper {
  slug: string;
  document: ApiDocument;
}

export interface ApiSession {
  hash: string;
  isCurrent: boolean;
  isOfficialApp: boolean;
  isPasswordPending: boolean;
  deviceModel: string;
  platform: string;
  systemVersion: string;
  appName: string;
  appVersion: string;
  dateCreated: number;
  dateActive: number;
  ip: string;
  country: string;
  region: string;
  areCallsEnabled: boolean;
  areSecretChatsEnabled: boolean;
  isUnconfirmed?: true;
}

export interface ApiWebSession {
  hash: string;
  botId: string;
  domain: string;
  browser: string;
  platform: string;
  dateCreated: number;
  dateActive: number;
  ip: string;
  region: string;
}

export interface ApiSessionData {
  mainDcId: number;
  keys: Record<number, string | number[]>;
  hashes: Record<number, string | number[]>;
  isTest?: true;
}

export type ApiNotification = {
  localId: string;
  containerSelector?: string;
  title?: string | RegularLangFnParameters;
  message: TeactNode | RegularLangFnParameters;
  cacheBreaker?: string;
  actionText?: string | RegularLangFnParameters;
  action?: CallbackAction | CallbackAction[];
  className?: string;
  duration?: number;
  disableClickDismiss?: boolean;
  shouldShowTimer?: boolean;
  icon?: IconName;
  customEmojiIconId?: string;
  dismissAction?: CallbackAction;
};

export type ApiError = {
  message: string;
  hasErrorKey?: boolean;
  isSlowMode?: boolean;
  textParams?: Record<string, string>;
};

export type ApiFieldError = {
  field: string;
  message: string;
};

export type ApiExportedInvite = {
  isRevoked?: boolean;
  isPermanent?: boolean;
  link: string;
  date: number;
  startDate?: number;
  expireDate?: number;
  usageLimit?: number;
  usage?: number;
  isRequestNeeded?: boolean;
  requested?: number;
  title?: string;
  adminId: string;
};

export type ApiChatInviteInfo = {
  title: string;
  about?: string;
  photo?: ApiPhoto;
  isScam?: boolean;
  isFake?: boolean;
  isChannel?: boolean;
  isVerified?: boolean;
  isSuperGroup?: boolean;
  isPublic?: boolean;
  participantsCount?: number;
  participantIds?: string[];
  color: number;
  isBroadcast?: boolean;
  isRequestNeeded?: boolean;
  subscriptionFormId?: string;
  canRefulfillSubscription?: boolean;
  subscriptionPricing?: ApiStarsSubscriptionPricing;
  botVerification?: ApiBotVerification;
};

export type ApiChatInviteImporter = {
  userId: string;
  date: number;
  isRequested?: boolean;
  about?: string;
  isFromChatList?: boolean;
};

export interface ApiCountry {
  isHidden?: boolean;
  iso2: string;
  defaultName: string;
  name?: string;
}

export interface ApiCountryCode extends ApiCountry {
  countryCode: string;
  prefixes?: string[];
  patterns?: string[];
}

export interface ApiAppConfig {
  hash: number;
  emojiSounds: Record<string, string>;
  seenByMaxChatMembers: number;
  seenByExpiresAt: number;
  readDateExpiresAt: number;
  autologinDomains: string[];
  urlAuthDomains: string[];
  premiumInvoiceSlug: string;
  premiumBotUsername: string;
  isPremiumPurchaseBlocked: boolean;
  isGiveawayGiftsPurchaseAvailable: boolean;
  giveawayAddPeersMax: number;
  giveawayBoostsPerPremium: number;
  giveawayCountriesMax: number;
  boostsPerSentGift: number;
  premiumPromoOrder: ApiPremiumSection[];
  defaultEmojiStatusesStickerSetId: string;
  maxUniqueReactions: number;
  topicsPinnedLimit: number;
  maxUserReactionsDefault: number;
  maxUserReactionsPremium: number;
  hiddenMembersMinCount: number;
  limits: Record<ApiLimitType, readonly [number, number]>;
  canDisplayAutoarchiveSetting: boolean;
  areStoriesHidden?: boolean;
  storyExpirePeriod: number;
  storyViewersExpirePeriod: number;
  storyChangelogUserId: string;
  maxPinnedStoriesCount?: number;
  groupTranscribeLevelMin?: number;
  canLimitNewMessagesWithoutPremium?: boolean;
  bandwidthPremiumNotifyPeriod?: number;
  bandwidthPremiumUploadSpeedup?: number;
  bandwidthPremiumDownloadSpeedup?: number;
  channelRestrictAdsLevelMin?: number;
  paidReactionMaxAmount?: number;
  isChannelRevenueWithdrawalEnabled?: boolean;
  isStarsGiftEnabled?: boolean;
  starGiftMaxMessageLength?: number;
  starGiftMaxConvertPeriod?: number;
  starRefStartPrefixes?: string[];
  tonExplorerUrl?: string;
  savedGiftPinLimit?: number;
}

export interface ApiConfig {
  expiresAt: number;
  defaultReaction?: ApiReaction;
  gifSearchUsername?: string;
  maxGroupSize: number;
  autologinToken?: string;
  isTestServer?: boolean;
  maxMessageLength: number;
  editTimeLimit: number;
  maxForwardedCount: number;
}

export type ApiPeerColorSet = string[];

export interface ApiPeerColors {
  general: {
    [key: number]: {
      isHidden?: true;
      colors?: ApiPeerColorSet;
      darkColors?: ApiPeerColorSet;
    };
  };
  generalHash?: number;
}

export interface ApiTimezone {
  id: string;
  name: string;
  utcOffset: number;
}

export interface GramJsEmojiInteraction {
  v: number;
  a: {
    i: number;
    t: number;
  }[];
}

export interface ApiEmojiInteraction {
  timestamps: number[];
}

type ApiUrlAuthResultRequest = {
  type: 'request';
  bot: ApiUser;
  domain: string;
  shouldRequestWriteAccess?: boolean;
};

type ApiUrlAuthResultAccepted = {
  type: 'accepted';
  url: string;
};

type ApiUrlAuthResultDefault = {
  type: 'default';
};

export type ApiUrlAuthResult = ApiUrlAuthResultRequest | ApiUrlAuthResultAccepted | ApiUrlAuthResultDefault;

export interface ApiCollectibleInfo {
  amount: number;
  currency: string;
  cryptoAmount: number;
  cryptoCurrency: string;
  purchaseDate: number;
  url: string;
}

export interface ApiPeerPhotos {
  fallbackPhoto?: ApiPhoto;
  personalPhoto?: ApiPhoto;
  photos: ApiPhoto[];
  count: number;
  nextOffset?: number;
  isLoading?: boolean;
}

export interface ApiBotVerification {
  botId: string;
  iconId: string;
  description: string;
}

export type ApiLimitType =
  | 'uploadMaxFileparts'
  | 'stickersFaved'
  | 'savedGifs'
  | 'dialogFiltersChats'
  | 'dialogFilters'
  | 'dialogFolderPinned'
  | 'captionLength'
  | 'channels'
  | 'channelsPublic'
  | 'aboutLength'
  | 'chatlistInvites'
  | 'chatlistJoined'
  | 'recommendedChannels'
  | 'savedDialogsPinned';

export type ApiLimitTypeWithModal = Exclude<ApiLimitType, (
  'captionLength' | 'aboutLength' | 'stickersFaved' | 'savedGifs' | 'recommendedChannels'
)>;

export type ApiLimitTypeForPromo = Exclude<ApiLimitType,
'uploadMaxFileparts' | 'chatlistInvites' | 'chatlistJoined' | 'savedDialogsPinned'
>;

export type ApiPeerNotifySettings = {
  mutedUntil?: number;
  hasSound?: boolean;
  isSilentPosting?: boolean;
  shouldShowPreviews?: boolean;
};

export type ApiNotifyPeerType = 'users' | 'groups' | 'channels';
