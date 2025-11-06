import type {
  ApiAppConfig,
  ApiAttachBot,
  ApiAvailableEffect,
  ApiAvailableReaction,
  ApiBotPreviewMedia,
  ApiChat,
  ApiChatFolder,
  ApiChatFullInfo,
  ApiChatlistExportedInvite,
  ApiConfig,
  ApiCountry,
  ApiCountryCode,
  ApiEmojiStatusType,
  ApiGroupCall,
  ApiMessage,
  ApiNotifyPeerType,
  ApiPaidReactionPrivacyType,
  ApiPeerColors,
  ApiPeerNotifySettings,
  ApiPeerPhotos,
  ApiPeerStories,
  ApiPhoneCall,
  ApiPoll,
  ApiPrivacyKey,
  ApiPrivacySettings,
  ApiQuickReply,
  ApiReaction,
  ApiReactionKey,
  ApiSavedReactionTag,
  ApiSavedStarGift,
  ApiSession,
  ApiSponsoredMessage,
  ApiStarGiftCollection,
  ApiStarGiftRegular,
  ApiStarsAmount,
  ApiStarTopupOption,
  ApiStealthMode,
  ApiSticker,
  ApiStickerSet,
  ApiStoryAlbum,
  ApiTimezone,
  ApiTonAmount,
  ApiTranscription,
  ApiUpdateAuthorizationStateType,
  ApiUpdateConnectionStateType,
  ApiUser,
  ApiUserCommonChats,
  ApiUserFullInfo,
  ApiUserStatus,
  ApiVideo,
  ApiWallpaper,
  ApiWebPage,
  ApiWebSession,
} from '../../api/types';
import type {
  AccountSettings,
  AttachmentCompression,
  BotAppPermissions,
  ChatListType,
  ChatTranslatedMessages,
  EmojiKeywords,
  IThemeSettings,
  ServiceNotification,
  SimilarBotsInfo,
  StarGiftCategory,
  StarsSubscriptions,
  StarsTransactionHistory,
  ThemeKey,
  Thread,
  ThreadId,
  TopicsInfo,
  WebPageMediaSize,
} from '../../types';
import type { RegularLangFnParameters } from '../../util/localization';
import type { SharedState } from './sharedState';
import type { TabState } from './tabState';

export type GlobalState = {
  cacheVersion: number;
  isInited: boolean;
  config?: ApiConfig;
  appConfig: ApiAppConfig;
  peerColors?: ApiPeerColors;
  timezones?: {
    byId: Record<string, ApiTimezone>;
    hash: number;
  };
  hasWebAuthTokenFailed?: boolean;
  hasWebAuthTokenPasswordRequired?: true;
  isCacheApiSupported?: boolean;
  connectionState?: ApiUpdateConnectionStateType;
  currentUserId?: string;
  isSyncing?: boolean;
  isAppConfigLoaded?: boolean;
  isAppUpdateAvailable?: boolean;
  isSynced?: boolean;
  isFetchingDifference?: boolean;
  leftColumnWidth?: number;
  lastIsChatInfoShown?: boolean;
  initialUnreadNotifications?: number;
  shouldShowContextMenuHint?: boolean;
  botFreezeAppealId?: string;

  audioPlayer: {
    lastPlaybackRate: number;
    isLastPlaybackRateActive?: boolean;
  };

  mediaViewer: {
    lastPlaybackRate: number;
  };

  recentlyFoundChatIds?: string[];

  twoFaSettings: {
    hint?: string;
    isLoading?: boolean;
    errorKey?: RegularLangFnParameters;
    waitingEmailCodeLength?: number;
  };

  attachmentSettings: {
    shouldCompress: boolean;
    defaultAttachmentCompression: AttachmentCompression;
    shouldSendGrouped: boolean;
    isInvertedMedia?: true;
    webPageMediaSize?: WebPageMediaSize;
    shouldSendInHighQuality?: boolean;
  };

  attachMenu: {
    hash?: string;
    bots: Record<string, ApiAttachBot>;
  };

  passcode: {
    isScreenLocked?: boolean;
    hasPasscode?: boolean;
    error?: string;
    timeoutUntil?: number;
    invalidAttemptsCount?: number;
    invalidAttemptError?: string;
    isLoading?: boolean;
  };

  // TODO Move to `auth`.
  isLoggingOut?: boolean;
  authState?: ApiUpdateAuthorizationStateType;
  authPhoneNumber?: string;
  authIsLoading?: boolean;
  authIsLoadingQrCode?: boolean;
  authErrorKey?: RegularLangFnParameters;
  authRememberMe?: boolean;
  authNearestCountry?: string;
  authIsCodeViaApp?: boolean;
  authHint?: string;
  authQrCode?: {
    token: string;
    expires: number;
  };
  countryList: {
    phoneCodes: ApiCountryCode[];
    general: ApiCountry[];
  };

  contactList?: {
    userIds: string[];
  };

  blocked: {
    ids: string[];
    totalCount: number;
  };

  users: {
    byId: Record<string, ApiUser>;
    statusesById: Record<string, ApiUserStatus>;
    // Obtained from GetFullUser / UserFullInfo
    fullInfoById: Record<string, ApiUserFullInfo>;
    previewMediaByBotId: Record<string, ApiBotPreviewMedia[]>;
    commonChatsById: Record<string, ApiUserCommonChats>;
    botAppPermissionsById: Record<string, BotAppPermissions>;
  };

  peers: {
    profilePhotosById: Record<string, ApiPeerPhotos>;
  };

  chats: {
    // TODO Replace with `Partial<Record>` to properly handle missing keys
    byId: Record<string, ApiChat>;
    listIds: {
      active?: string[];
      archived?: string[];
      saved?: string[];
    };
    orderedPinnedIds: {
      active?: string[];
      archived?: string[];
      saved?: string[];
    };
    totalCount: {
      all?: number;
      archived?: number;
      saved?: number;
    };
    isFullyLoaded: {
      active?: boolean;
      archived?: boolean;
      saved?: boolean;
    };
    lastMessageIds: {
      all?: Record<string, number>;
      saved?: Record<string, number>;
    };
    topicsInfoById: Record<string, TopicsInfo>;
    loadingParameters: Record<ChatListType, {
      nextOffsetId?: number;
      nextOffsetPeerId?: string;
      nextOffsetDate?: number;
    }>;
    forDiscussionIds?: string[];
    // Obtained from GetFullChat / GetFullChannel
    fullInfoById: Record<string, ApiChatFullInfo>;
    similarChannelsById: Partial<Record<string, {
      isExpanded: boolean;
      similarChannelIds?: string[];
      count?: number;
    }>>;
    notifyExceptionById: Record<string, ApiPeerNotifySettings>;

    similarBotsById: Record<string, SimilarBotsInfo>;
  };

  messages: {
    byChatId: Record<string, {
      byId: Record<number, ApiMessage>;
      threadsById: Record<ThreadId, Thread>;
    }>;
    playbackByChatId: Record<string, {
      byId: Record<number, number>;
    }>;
    sponsoredByChatId: Record<string, ApiSponsoredMessage>;
    pollById: Record<string, ApiPoll>;
    webPageById: Record<string, ApiWebPage>;
  };

  stories: {
    byPeerId: Record<string, ApiPeerStories>;
    hasNext?: boolean;
    stateHash?: string;
    hasNextInArchive?: boolean;
    archiveStateHash?: string;
    orderedPeerIds: {
      active: string[];
      archived: string[];
    };
    stealthMode: ApiStealthMode;
    albumsByPeerId: Record<string, ApiStoryAlbum[]>;
  };

  groupCalls: {
    byId: Record<string, ApiGroupCall>;
    activeGroupCallId?: string;
  };

  scheduledMessages: {
    byChatId: Record<string, {
      byId: Record<number, ApiMessage>;
    }>;
  };

  quickReplies: {
    messagesById: Record<number, ApiMessage>;
    byId: Record<number, ApiQuickReply>;
  };

  chatFolders: {
    orderedIds?: number[];
    byId: Record<number, ApiChatFolder>;
    invites: Record<number, ApiChatlistExportedInvite[]>;
    recommended?: ApiChatFolder[];
    areTagsEnabled?: boolean;
  };

  phoneCall?: ApiPhoneCall;

  fileUploads: {
    byMessageKey: Record<string, {
      progress: number;
    }>;
  };

  recentEmojis: string[];
  recentCustomEmojis: string[];

  reactions: {
    topReactions: ApiReaction[];
    recentReactions: ApiReaction[];
    defaultTags: ApiReaction[];
    effectReactions: ApiReaction[];
    availableReactions?: ApiAvailableReaction[];
    hash: {
      topReactions?: string;
      recentReactions?: string;
      defaultTags?: string;
    };
  };
  availableEffectById: Record<string, ApiAvailableEffect>;
  starGifts?: {
    byId: Record<string, ApiStarGiftRegular>;
    idsByCategory: Record<StarGiftCategory, string[]>;
  };
  myUniqueGifts?: {
    byId: Record<string, ApiSavedStarGift>;
    ids: string[];
    nextOffset?: string;
  };
  starGiftCollections?: {
    byPeerId: Record<string, ApiStarGiftCollection[]>;
  };

  stickers: {
    setsById: Record<string, ApiStickerSet>;
    added: {
      hash?: string;
      setIds?: string[];
    };
    recent: {
      hash?: string;
      stickers: ApiSticker[];
    };
    favorite: {
      hash?: string;
      stickers: ApiSticker[];
    };
    greeting: {
      hash?: string;
      stickers: ApiSticker[];
    };
    premium: {
      hash?: string;
      stickers: ApiSticker[];
    };
    featured: {
      hash?: string;
      setIds?: string[];
    };
    forEmoji: {
      emoji?: string;
      stickers?: ApiSticker[];
      hash?: string;
    };
    effect: {
      stickers: ApiSticker[];
      emojis: ApiSticker[];
    };
  };

  customEmojis: {
    added: {
      hash?: string;
      setIds?: string[];
    };
    lastRendered: string[];
    byId: Record<string, ApiSticker>;
    forEmoji: {
      emoji?: string;
      stickers?: ApiSticker[];
    };
    featuredIds?: string[];
    statusRecent: {
      hash?: string;
      emojis?: ApiSticker[];
    };
  };

  animatedEmojis?: ApiStickerSet;
  animatedEmojiEffects?: ApiStickerSet;
  genericEmojiEffects?: ApiStickerSet;
  birthdayNumbers?: ApiStickerSet;
  restrictedEmoji?: ApiStickerSet;
  defaultTopicIconsId?: string;
  defaultStatusIconsId?: string;
  premiumGifts?: ApiStickerSet;
  tonGifts?: ApiStickerSet;
  emojiKeywords: Record<string, EmojiKeywords | undefined>;

  collectibleEmojiStatuses?: {
    statuses: ApiEmojiStatusType[];
    hash?: string;
  };

  gifs: {
    saved: {
      hash?: string;
      gifs?: ApiVideo[];
    };
  };

  topPeers: {
    userIds?: string[];
    lastRequestedAt?: number;
  };

  topInlineBots: {
    userIds?: string[];
    lastRequestedAt?: number;
  };

  topBotApps: {
    userIds?: string[];
    lastRequestedAt?: number;
  };

  activeSessions: {
    byHash: Record<string, ApiSession>;
    orderedHashes: string[];
    ttlDays?: number;
  };

  activeWebSessions: {
    byHash: Record<string, ApiWebSession>;
    orderedHashes: string[];
  };

  settings: {
    byKey: AccountSettings;
    loadedWallpapers?: ApiWallpaper[];
    privacy: Partial<Record<ApiPrivacyKey, ApiPrivacySettings>>;
    notifyDefaults?: Record<ApiNotifyPeerType, ApiPeerNotifySettings>;
    lastPremiumBandwithNotificationDate?: number;
    paidReactionPrivacy?: ApiPaidReactionPrivacyType;
    botVerificationShownPeerIds: string[];
    themes: Partial<Record<ThemeKey, IThemeSettings>>;
    accountDaysTtl: number;
  };

  push?: {
    deviceToken: string;
    subscribedAt: number;
  };

  transcriptions: Record<string, ApiTranscription>;
  trustedBotIds: string[];

  serviceNotifications: ServiceNotification[];

  byTabId: Record<number, TabState>;
  sharedState: SharedState;

  archiveSettings: {
    isMinimized: boolean;
    isHidden: boolean;
  };

  translations: {
    byChatId: Record<string, ChatTranslatedMessages>;
  };

  savedReactionTags?: {
    byKey: Record<ApiReactionKey, ApiSavedReactionTag>;
    hash: string;
  };

  stars?: {
    topupOptions: ApiStarTopupOption[];
    balance: ApiStarsAmount;
    history: StarsTransactionHistory;
    subscriptions?: StarsSubscriptions;
  };
  ton?: {
    balance: ApiTonAmount;
    history: StarsTransactionHistory;
  };
};

export type RequiredGlobalState = GlobalState & { _: never };
export type ActionReturnType = GlobalState | void | Promise<void>;
export type TabArgs<T> = T extends RequiredGlobalState ? [
  tabId: number,
] : [
  tabId?: number | undefined,
];
