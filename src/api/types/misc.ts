import type { TeactNode } from '../../lib/teact/teact';

import type { CallbackAction } from '../../global/types';
import type { IconName } from '../../types/icons';
import type { RegularLangFnParameters } from '../../util/localization';
import type { ApiDocument, ApiFormattedText, ApiPhoto, ApiReaction } from './messages';
import type { ApiPremiumSection } from './payments';
import type { ApiBotVerification } from './peers';
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
  accountIds?: string[];
  hasPasskeySupport?: boolean;
}

export type ApiPasskeyOption = {
  publicKey: PublicKeyCredentialRequestOptionsJSON;
};

export type ApiPasskeyRegistrationOption = {
  publicKey: PublicKeyCredentialCreationOptionsJSON;
};

export interface ApiOnProgress {
  (
    progress: number, // Float between 0 and 1.
    ...args: any[]
  ): void;

  isCanceled?: boolean;
}

export interface ApiAttachment {
  blob: Blob;
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
  shouldSendInHighQuality?: boolean;
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
  keys: Record<number, string>;
  isTest?: true;
}

export type ApiNotification = {
  localId: string;
  containerSelector?: string;
  type?: 'paidMessage' | undefined;
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
  shouldUseCustomIcon?: boolean;
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
  whitelistedDomains: string[];
  premiumInvoiceSlug?: string;
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
  hiddenMembersMinCount: number;
  limits: Record<ApiLimitType, readonly [number, number]>;
  canDisplayAutoarchiveSetting?: boolean;
  storyViewersExpirePeriod: number;
  storyChangelogUserId: string;
  maxPinnedStoriesCount: number;
  groupTranscribeLevelMin: number;
  canLimitNewMessagesWithoutPremium: boolean;
  starsPaidMessagesAvailable?: boolean;
  starsPaidMessageCommissionPermille?: number;
  starsPaidMessageAmountMax?: number;
  starsUsdWithdrawRateX1000: number;
  bandwidthPremiumNotifyPeriod?: number;
  bandwidthPremiumUploadSpeedup?: number;
  bandwidthPremiumDownloadSpeedup?: number;
  channelRestrictAdsLevelMin?: number;
  channelAutoTranslationLevelMin?: number;
  channelLevelMax: number;
  paidReactionMaxAmount?: number;
  isChannelRevenueWithdrawalEnabled?: boolean;
  isStarsGiftEnabled?: boolean;
  starGiftMaxMessageLength?: number;
  starGiftMaxConvertPeriod?: number;
  starRefStartPrefixes?: string[];
  tonExplorerUrl?: string;
  savedGiftPinLimit?: number;
  freezeSinceDate?: number;
  freezeUntilDate?: number;
  freezeAppealUrl?: string;
  starsStargiftResaleAmountMin?: number;
  starsStargiftResaleAmountMax?: number;
  starsStargiftResaleCommissionPermille?: number;
  starsSuggestedPostAmountMax: number;
  starsSuggestedPostAmountMin: number;
  starsSuggestedPostCommissionPermille: number;
  starsSuggestedPostAgeMin: number;
  starsSuggestedPostFutureMax: number;
  starsSuggestedPostFutureMin: number;
  tonSuggestedPostCommissionPermille: number;
  tonSuggestedPostAmountMax: number;
  tonSuggestedPostAmountMin: number;
  tonStargiftResaleAmountMax?: number;
  tonStargiftResaleAmountMin?: number;
  tonStargiftResaleCommissionPermille?: number;
  tonUsdRate?: number;
  tonTopupUrl: string;
  pollMaxAnswers?: number;
  todoItemsMax: number;
  todoTitleLengthMax: number;
  todoItemLengthMax: number;
  ignoreRestrictionReasons?: string[];
  needAgeVideoVerification?: boolean;
  verifyAgeBotUsername?: string;
  verifyAgeCountry?: string;
  verifyAgeMin?: number;
  typingDraftTtl: number;
  contactNoteLimit?: number;
  whitelistedBotIds?: string[];
  arePasskeysAvailable: boolean;
  passkeysMaxCount: number;
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

export interface ApiPromoData {
  expires: number;
  pendingSuggestions: string[];
  dismissedSuggestions: string[];
  customPendingSuggestion?: ApiPendingSuggestion;
}

export interface ApiPendingSuggestion {
  suggestion: string;
  title: ApiFormattedText;
  description: ApiFormattedText;
  url: string;
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
  | 'savedDialogsPinned'
  | 'maxReactions'
  | 'moreAccounts';

export type ApiLimitTypeWithModal = Exclude<ApiLimitType, (
  'captionLength' | 'aboutLength' | 'stickersFaved' | 'savedGifs' | 'recommendedChannels' | 'moreAccounts'
  | 'maxReactions'
)>;

export type ApiLimitTypeForPromo = Exclude<ApiLimitType,
'uploadMaxFileparts' | 'chatlistInvites' | 'chatlistJoined' | 'savedDialogsPinned' | 'maxReactions'
>;

export type ApiPeerNotifySettings = {
  mutedUntil?: number;
  hasSound?: boolean;
  isSilentPosting?: boolean;
  shouldShowPreviews?: boolean;
};

export type ApiNotifyPeerType = 'users' | 'groups' | 'channels';

export interface ApiRestrictionReason {
  reason: string;
  text: string;
  platform: string;
}

export interface ApiPasskey {
  id: string;
  name: string;
  date: number;
  softwareEmojiId?: string;
  lastUsageDate?: number;
}
