import type { ApiLimitType, CallbackAction } from '../../global/types';
import type { ApiDocument, ApiPhoto, ApiReaction } from './messages';
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
}

export type ApiNotifyException = {
  chatId: string;
  isMuted: boolean;
  isSilent?: boolean;
  shouldShowPreviews?: boolean;
};

export type ApiNotification = {
  localId: string;
  title?: string;
  message: string;
  actionText?: string;
  action?: CallbackAction | CallbackAction[];
  className?: string;
  duration?: number;
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

export type ApiInviteInfo = {
  title: string;
  about?: string;
  hash: string;
  isChannel?: boolean;
  participantsCount?: number;
  isRequestNeeded?: true;
  photo?: ApiPhoto;
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
  autologinDomains: string[];
  urlAuthDomains: string[];
  premiumInvoiceSlug: string;
  premiumBotUsername: string;
  isPremiumPurchaseBlocked: boolean;
  premiumPromoOrder: string[];
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
}

export interface ApiConfig {
  expiresAt: number;
  defaultReaction?: ApiReaction;
  gifSearchUsername?: string;
  maxGroupSize: number;
  autologinToken?: string;
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
