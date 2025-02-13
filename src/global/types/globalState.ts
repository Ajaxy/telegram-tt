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
  ApiLanguage,
  ApiMessage,
  ApiPeerColors,
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
  ApiSession,
  ApiSponsoredMessage,
  ApiStarGiftRegular,
  ApiStarsAmount,
  ApiStarTopupOption,
  ApiStealthMode,
  ApiSticker,
  ApiStickerSet,
  ApiTimezone,
  ApiTranscription,
  ApiUpdateAuthorizationStateType,
  ApiUpdateConnectionStateType,
  ApiUser,
  ApiUserCommonChats,
  ApiUserFullInfo,
  ApiUserStatus,
  ApiVideo,
  ApiWallpaper,
  ApiWebSession,
} from '../../api/types';
import type {
  BotAppPermissions,
  ChatListType,
  ChatTranslatedMessages,
  EmojiKeywords,
  ISettings,
  IThemeSettings,
  NotifyException,
  PerformanceType,
  Point,
  ServiceNotification,
  SimilarBotsInfo,
  Size,
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
import type { TabState } from './tabState';

export type GlobalState = {
  isInited: boolean;
  config?: ApiConfig;
  appConfig?: ApiAppConfig;
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
  isAppUpdateAvailable?: boolean;
  isElectronUpdateAvailable?: boolean;
  isSynced?: boolean;
  isFetchingDifference?: boolean;
  leftColumnWidth?: number;
  lastIsChatInfoShown?: boolean;
  initialUnreadNotifications?: number;
  shouldShowContextMenuHint?: boolean;

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
    shouldSendGrouped: boolean;
    isInvertedMedia?: true;
    webPageMediaSize?: WebPageMediaSize;
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

    similarBotsById: Record<string, SimilarBotsInfo>;
  };

  messages: {
    byChatId: Record<string, {
      byId: Record<number, ApiMessage>;
      threadsById: Record<ThreadId, Thread>;
    }>;
    sponsoredByChatId: Record<string, ApiSponsoredMessage>;
    pollById: Record<string, ApiPoll>;
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
    byKey: ISettings;
    performance: PerformanceType;
    loadedWallpapers?: ApiWallpaper[];
    themes: Partial<Record<ThemeKey, IThemeSettings>>;
    privacy: Partial<Record<ApiPrivacyKey, ApiPrivacySettings>>;
    notifyExceptions?: Record<number, NotifyException>;
    lastPremiumBandwithNotificationDate?: number;
    paidReactionPrivacy?: boolean;
    languages?: ApiLanguage[];
    botVerificationShownPeerIds: string[];
    miniAppsCachedPosition?: Point;
    miniAppsCachedSize?: Size;
  };

  push?: {
    deviceToken: string;
    subscribedAt: number;
  };

  transcriptions: Record<string, ApiTranscription>;
  trustedBotIds: string[];

  serviceNotifications: ServiceNotification[];

  byTabId: Record<number, TabState>;

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
};

export type RequiredGlobalState = GlobalState & { _: never };
export type ActionReturnType = GlobalState | void | Promise<void>;
export type TabArgs<T> = T extends RequiredGlobalState ? [
  tabId: number,
] : [
  tabId?: number | undefined,
];
