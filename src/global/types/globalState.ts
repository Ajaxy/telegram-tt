import type {
  ApiAiComposeToneType,
  ApiAppConfig,
  ApiAttachBot,
  ApiAudio,
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
  ApiEmojiGroup,
  ApiEmojiStatusType,
  ApiGroupCall,
  ApiMessage,
  ApiMessagePoll,
  ApiNotifyPeerType,
  ApiOnrampProvider,
  ApiPaidReactionPrivacyType,
  ApiPasskey,
  ApiPasskeyOption,
  ApiPeerColors,
  ApiPeerNotifySettings,
  ApiPeerPhotos,
  ApiPeerStories,
  ApiPhoneCall,
  ApiPrivacyKey,
  ApiPrivacySettings,
  ApiPromoData,
  ApiQuickReply,
  ApiReaction,
  ApiReactionKey,
  ApiSavedReactionTag,
  ApiSavedStarGift,
  ApiSession,
  ApiSponsoredMessage,
  ApiStarGiftAuctionState,
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
  ApiTonConnectSession,
  ApiTopPeerCategory,
  ApiTranscription,
  ApiUpdateAuthorizationStateType,
  ApiUpdateConnectionStateType,
  ApiUser,
  ApiUserCommonChats,
  ApiUserFullInfo,
  ApiUserSavedMusic,
  ApiUserStatus,
  ApiVideo,
  ApiWalletCollectible,
  ApiWalletGaslessInfo,
  ApiWalletSavedWallet,
  ApiWalletState,
  ApiWalletStatus,
  ApiWalletTransaction,
  ApiWalletUserAddress,
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
  OrderMode,
  RepeatMode,
  ServiceNotification,
  SimilarBotsInfo,
  StarGiftCategory,
  StarsSubscriptions,
  StarsTransactionHistory,
  TextSummary,
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
  promoData?: ApiPromoData;
  peerColors?: ApiPeerColors;
  timezones?: {
    byId: Record<string, ApiTimezone>;
    hash: number;
  };
  aiComposeTones?: {
    tones: ApiAiComposeToneType[];
    hash: string;
  };
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
  reactionPollingPause?: {
    until: number;
    chatId: string;
  };

  audioPlayer: {
    volume: number;
    lastPlaybackRate: number;
    isLastPlaybackRateActive?: boolean;
    repeatMode: RepeatMode;
    orderMode: OrderMode;
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
    hasPasskey?: boolean;
    autolockDuration?: number;
    isDataCorrupted?: boolean;
    errorKey?: RegularLangFnParameters;
    timeoutUntil?: number;
    invalidAttemptsCount?: number;
    isLoading?: boolean;
  };

  auth: {
    isLoggingOut?: boolean;
    state?: ApiUpdateAuthorizationStateType;
    phoneNumber?: string;
    isLoading?: boolean;
    isLoadingQrCode?: boolean;
    errorKey?: RegularLangFnParameters;
    rememberMe?: boolean;
    nearestCountry?: string;
    isCodeViaApp?: boolean;
    hint?: string;
    qrCode?: {
      token: string;
      expires: number;
    };
    passkeyOption?: ApiPasskeyOption;

    hasWebAuthTokenFailed?: true;
    hasWebAuthTokenPasswordRequired?: true;
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
    savedMusicById?: Record<string, true>;
    isSavedMusicLoading?: boolean;
    savedMusicByPeerId: Record<string, ApiUserSavedMusic>;
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

    personalChannelIds?: string[];
  };

  messages: {
    byChatId: Record<string, {
      byId: Record<number, ApiMessage>;
      ephemeralById: Record<number, ApiMessage>;
      anchoredById: Record<number, ApiMessage>;
      summaryById: Record<number, TextSummary>;
      threadsById: Record<ThreadId, Thread>;
    }>;
    playbackByChatId: Record<string, {
      byId: Record<number, number>;
    }>;
    sponsoredByChatId: Record<string, ApiSponsoredMessage>;
    pollById: Record<string, ApiMessagePoll>;
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
  activeGiftAuctionIds?: string[];
  giftAuctionByGiftId?: Record<string, ApiStarGiftAuctionState>;

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
      isPremium?: boolean;
      hiddenSetId?: string;
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
    diceSetIdByEmoji?: Record<string, string>;
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

  emojiGroups: {
    hash?: number;
    groups?: ApiEmojiGroup[];
    stickerHash?: number;
    stickerGroups?: ApiEmojiGroup[];
  };

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

  musicSearch: {
    audiosById: Record<string, ApiAudio>;
  };

  topPeerCategories: Partial<Record<ApiTopPeerCategory, {
    peerIds: string[];
    ratingsByPeerId: Record<string, number>;
    lastRequestedAt?: number;
    isDisabled?: boolean;
  }>>;

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
    accountDaysTtl: number;
    passkeys?: ApiPasskey[];
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
  wallet?: {
    tonConnectSessions?: ApiTonConnectSession[];
    isLoadingTonConnectSessions?: boolean;
    hasTonConnectSessionsError?: boolean;
    // Unknown until the first `wallet.getState` answers
    status?: ApiWalletStatus;
    // The last `wallet.getState` failed
    hasStateError?: boolean;
    state?: ApiWalletState;
    transactions?: ApiWalletTransaction[];
    // `undefined` means the whole history is loaded; the empty string is the cache's "stale, refresh first"
    nextOffset?: string;
    collectibles?: ApiWalletCollectible[];
    collectiblesNextOffset?: string;
    // Empty for a user the server knows no wallet of
    userAddresses?: Record<string, string>;
    // `false` records an address with no Telegram user
    resolvedAddresses?: Record<string, ApiWalletUserAddress | false>;
    hasLocalSecret?: boolean;
    // Tells the echo of a swap made here from a swap made on another device
    isReplacing?: boolean;
    // The server balance a sent transfer was deducted from; the same figure from the server is stale
    staleBalance?: {
      amount: bigint;
      // Server time, seconds
      expiresAt: number;
    };
    onrampProviders?: ApiOnrampProvider[];
    decryptedComments?: Record<string, string>;
    gaslessInfo?: ApiWalletGaslessInfo;
    // Nanotons
    keyRotationFee?: bigint;
    loadedTransactions?: Record<string, ApiWalletTransaction>;
    savedWallets?: ApiWalletSavedWallet[];
    // Present while the former wallet bot still holds money
    existingWaltBalanceUrl?: string;
  };

  // Against USD
  currencyRates?: Record<string, number>;
  walletCurrency?: string;
};

export type RequiredGlobalState = GlobalState & { _: never };
export type ActionReturnType = GlobalState | void | Promise<void>;
export type TabArgs<T> = T extends RequiredGlobalState ? [
  tabId: number,
] : [
  tabId?: number | undefined,
];
