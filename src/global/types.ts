import type {
  ApiChat,
  ApiMessage,
  ApiThreadInfo,
  ApiUser,
  ApiUserStatus,
  ApiUpdateAuthorizationStateType,
  ApiUpdateConnectionStateType,
  ApiStickerSet,
  ApiSticker,
  ApiWebPage,
  ApiVideo,
  ApiFormattedText,
  ApiChatFolder,
  ApiWallpaper,
  ApiNotification,
  ApiError,
  ApiGlobalMessageSearchType,
  ApiPaymentSavedInfo,
  ApiSession,
  ApiNewPoll,
  ApiInviteInfo,
  ApiCountryCode,
  ApiCountry,
  ApiGroupCall,
  ApiAvailableReaction,
  ApiAppConfig,
  ApiSponsoredMessage,
  ApiChannelStatistics,
  ApiGroupStatistics,
  ApiMessageStatistics,
  ApiPaymentFormNativeParams,
  ApiUpdate,
  ApiReportReason,
  ApiPhoto,
  ApiKeyboardButton,
  ApiThemeParameters,
  ApiAttachBot,
  ApiPhoneCall,
  ApiWebSession,
  ApiPremiumPromo,
  ApiTranscription,
  ApiInputInvoice,
  ApiInvoice,
  ApiStickerSetInfo,
  ApiChatType,
  ApiReceipt,
  ApiPaymentCredentials,
} from '../api/types';
import type {
  FocusDirection,
  ISettings,
  MediaViewerOrigin,
  ChatCreationProgress,
  ProfileEditProgress,
  SharedMediaType,
  GlobalSearchContent,
  ManagementProgress,
  PaymentStep,
  ShippingOption,
  ApiInvoiceContainer,
  ApiPrivacyKey,
  ApiPrivacySettings,
  ThemeKey,
  IThemeSettings,
  NotifyException,
  LangCode,
  EmojiKeywords,
  InlineBotSettings,
  NewChatMembersProgress,
  AudioOrigin,
  ManagementState,
  SettingsScreens,
} from '../types';
import { typify } from '../lib/teact/teactn';
import type { P2pMessage } from '../lib/secret-sauce';

export type MessageListType =
  'thread'
  | 'pinned'
  | 'scheduled';

export interface MessageList {
  chatId: string;
  threadId: number;
  type: MessageListType;
}

export interface ActiveEmojiInteraction {
  id: number;
  x: number;
  y: number;
  messageId?: number;
  startSize?: number;
  animatedEffect?: string;
  isReversed?: boolean;
}

export interface ActiveReaction {
  messageId?: number;
  reaction?: string;
}

export interface Thread {
  listedIds?: number[];
  outlyingIds?: number[];
  viewportIds?: number[];
  pinnedIds?: number[];
  scheduledIds?: number[];
  scrollOffset?: number;
  replyingToId?: number;
  editingId?: number;
  editingScheduledId?: number;
  editingDraft?: ApiFormattedText;
  editingScheduledDraft?: ApiFormattedText;
  draft?: ApiFormattedText;
  noWebPage?: boolean;
  threadInfo?: ApiThreadInfo;
  firstMessageId?: number;
  replyStack?: number[];
}

export interface ServiceNotification {
  id: number;
  message: ApiMessage;
  version?: string;
  isUnread?: boolean;
  isDeleted?: boolean;
}

export type ApiLimitType = (
  'uploadMaxFileparts' | 'stickersFaved' | 'savedGifs' | 'dialogFiltersChats' | 'dialogFilters' | 'dialogFolderPinned' |
  'captionLength' | 'channels' | 'channelsPublic' | 'aboutLength'
);

export type ApiLimitTypeWithModal = Exclude<ApiLimitType, (
  'captionLength' | 'aboutLength' | 'stickersFaved' | 'savedGifs'
)>;

export type GlobalState = {
  appConfig?: ApiAppConfig;
  canInstall?: boolean;
  isChatInfoShown: boolean;
  isStatisticsShown?: boolean;
  isLeftColumnShown: boolean;
  newChatMembersProgress?: NewChatMembersProgress;
  uiReadyState: 0 | 1 | 2;
  shouldSkipHistoryAnimations?: boolean;
  connectionState?: ApiUpdateConnectionStateType;
  currentUserId?: string;
  isSyncing?: boolean;
  isUpdateAvailable?: boolean;
  lastSyncTime?: number;
  serverTimeOffset: number;
  leftColumnWidth?: number;

  // TODO Move to `auth`.
  isLoggingOut?: boolean;
  authState?: ApiUpdateAuthorizationStateType;
  authPhoneNumber?: string;
  authIsLoading?: boolean;
  authIsLoadingQrCode?: boolean;
  authError?: string;
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
  };

  chats: {
    // TODO Replace with `Partial<Record>` to properly handle missing keys
    byId: Record<string, ApiChat>;
    listIds: {
      active?: string[];
      archived?: string[];
    };
    orderedPinnedIds: {
      active?: string[];
      archived?: string[];
    };
    totalCount: {
      all?: number;
      archived?: number;
    };
    isFullyLoaded: {
      active?: boolean;
      archived?: boolean;
    };
    forDiscussionIds?: string[];
  };

  messages: {
    byChatId: Record<string, {
      byId: Record<number, ApiMessage>;
      threadsById: Record<number, Thread>;
    }>;
    messageLists: MessageList[];
    contentToBeScheduled?: {
      gif?: ApiVideo;
      sticker?: ApiSticker;
      poll?: ApiNewPoll;
      isSilent?: boolean;
    };
    sponsoredByChatId: Record<string, ApiSponsoredMessage>;
  };

  groupCalls: {
    byId: Record<string, ApiGroupCall>;
    activeGroupCallId?: string;
  };

  isCallPanelVisible?: boolean;
  phoneCall?: ApiPhoneCall;
  ratingPhoneCall?: ApiPhoneCall;

  scheduledMessages: {
    byChatId: Record<string, {
      byId: Record<number, ApiMessage>;
    }>;
  };

  chatFolders: {
    orderedIds?: number[];
    byId: Record<number, ApiChatFolder>;
    recommended?: ApiChatFolder[];
    activeChatFolder: number;
  };

  focusedMessage?: {
    chatId?: string;
    threadId?: number;
    messageId?: number;
    direction?: FocusDirection;
    noHighlight?: boolean;
    isResizingContainer?: boolean;
  };

  selectedMessages?: {
    chatId: string;
    messageIds: number[];
  };

  seenByModal?: {
    chatId: string;
    messageId: number;
  };

  reactorModal?: {
    chatId: string;
    messageId: number;
  };

  fileUploads: {
    byMessageLocalId: Record<string, {
      progress: number;
    }>;
  };

  recentEmojis: string[];
  recentCustomEmojis: string[];

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
    premiumSet: {
      hash?: string;
      stickers: ApiSticker[];
    };
    featured: {
      hash?: string;
      setIds?: string[];
    };
    search: {
      query?: string;
      resultIds?: string[];
    };
    forEmoji: {
      emoji?: string;
      stickers?: ApiSticker[];
      hash?: string;
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
  };

  animatedEmojis?: ApiStickerSet;
  animatedEmojiEffects?: ApiStickerSet;
  premiumGifts?: ApiStickerSet;
  emojiKeywords: Partial<Record<LangCode, EmojiKeywords>>;

  gifs: {
    saved: {
      hash?: string;
      gifs?: ApiVideo[];
    };
    search: {
      query?: string;
      offset?: string;
      results?: ApiVideo[];
    };
  };

  inlineBots: {
    isLoading: boolean;
    byUsername: Record<string, false | InlineBotSettings>;
  };

  globalSearch: {
    query?: string;
    date?: number;
    recentlyFoundChatIds?: string[];
    currentContent?: GlobalSearchContent;
    chatId?: string;
    fetchingStatus?: {
      chats?: boolean;
      messages?: boolean;
    };
    localResults?: {
      chatIds?: string[];
      userIds?: string[];
    };
    globalResults?: {
      chatIds?: string[];
      userIds?: string[];
    };
    resultsByType?: Partial<Record<ApiGlobalMessageSearchType, {
      totalCount?: number;
      nextOffsetId: number;
      foundIds: string[];
    }>>;
  };

  userSearch: {
    query?: string;
    fetchingStatus?: boolean;
    localUserIds?: string[];
    globalUserIds?: string[];
  };

  availableReactions?: ApiAvailableReaction[];
  activeEmojiInteractions?: ActiveEmojiInteraction[];
  activeReactions: Record<number, ActiveReaction>;

  localTextSearch: {
    byChatThreadKey: Record<string, {
      isActive: boolean;
      query?: string;
      results?: {
        totalCount?: number;
        nextOffsetId?: number;
        foundIds?: number[];
      };
    }>;
  };

  localMediaSearch: {
    byChatId: Record<string, {
      currentType?: SharedMediaType;
      resultsByType?: Partial<Record<SharedMediaType, {
        totalCount?: number;
        nextOffsetId: number;
        foundIds: number[];
      }>>;
    }>;
  };

  management: {
    progress?: ManagementProgress;
    byChatId: Record<string, ManagementState>;
  };

  mediaViewer: {
    chatId?: string;
    threadId?: number;
    mediaId?: number;
    avatarOwnerId?: string;
    profilePhotoIndex?: number;
    origin?: MediaViewerOrigin;
    volume: number;
    playbackRate: number;
    isMuted: boolean;
    isHidden?: boolean;
  };

  audioPlayer: {
    chatId?: string;
    messageId?: number;
    threadId?: number;
    origin?: AudioOrigin;
    volume: number;
    playbackRate: number;
    isMuted: boolean;
  };

  topPeers: {
    userIds?: string[];
    lastRequestedAt?: number;
  };

  topInlineBots: {
    userIds?: string[];
    lastRequestedAt?: number;
  };

  webPagePreview?: ApiWebPage;

  forwardMessages: {
    isModalShown?: boolean;
    fromChatId?: string;
    messageIds?: number[];
    toChatId?: string;
    withMyScore?: boolean;
    noAuthors?: boolean;
    noCaptions?: boolean;
  };

  pollResults: {
    chatId?: string;
    messageId?: number;
    voters?: Record<string, string[]>; // TODO Rename to `voterIds`
    offsets?: Record<string, string>;
  };

  payment: {
    inputInvoice?: ApiInputInvoice;
    step?: PaymentStep;
    status?: 'paid' | 'failed' | 'pending' | 'cancelled';
    shippingOptions?: ShippingOption[];
    formId?: string;
    requestId?: string;
    savedInfo?: ApiPaymentSavedInfo;
    canSaveCredentials?: boolean;
    invoice?: ApiInvoice;
    invoiceContainer?: Omit<ApiInvoiceContainer, 'receiptMsgId'>;
    nativeProvider?: string;
    providerId?: string;
    nativeParams?: ApiPaymentFormNativeParams;
    stripeCredentials?: {
      type: string;
      id: string;
    };
    smartGlocalCredentials?: {
      type: string;
      token: string;
    };
    passwordMissing?: boolean;
    savedCredentials?: ApiPaymentCredentials[];
    receipt?: ApiReceipt;
    error?: {
      field?: string;
      message?: string;
      description?: string;
    };
    isPaymentModalOpen?: boolean;
    isExtendedMedia?: boolean;
    confirmPaymentUrl?: string;
    temporaryPassword?: {
      value: string;
      validUntil: number;
    };
  };

  chatCreation?: {
    progress: ChatCreationProgress;
    error?: string;
  };

  profileEdit?: {
    progress: ProfileEditProgress;
    checkedUsername?: string;
    isUsernameAvailable?: boolean;
  };

  notifications: ApiNotification[];
  dialogs: (ApiError | ApiInviteInfo)[];

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
    loadedWallpapers?: ApiWallpaper[];
    themes: Partial<Record<ThemeKey, IThemeSettings>>;
    privacy: Partial<Record<ApiPrivacyKey, ApiPrivacySettings>>;
    notifyExceptions?: Record<number, NotifyException>;
    nextScreen?: SettingsScreens;
  };

  twoFaSettings: {
    hint?: string;
    isLoading?: boolean;
    error?: string;
    waitingEmailCodeLength?: number;
  };

  passcode: {
    isScreenLocked?: boolean;
    hasPasscode?: boolean;
    error?: string;
    invalidAttemptsCount?: number;
    isLoading?: boolean;
  };

  push?: {
    deviceToken: string;
    subscribedAt: number;
  };

  safeLinkModalUrl?: string;
  historyCalendarSelectedAt?: number;
  openedStickerSetShortName?: string;
  openedCustomEmojiSetIds?: string[];

  activeDownloads: {
    byChatId: Record<string, number[]>;
  };

  shouldShowContextMenuHint?: boolean;

  serviceNotifications: ServiceNotification[];

  statistics: {
    byChatId: Record<string, ApiChannelStatistics | ApiGroupStatistics>;
    currentMessage?: ApiMessageStatistics;
    currentMessageId?: number;
  };

  newContact?: {
    userId?: string;
    isByPhoneNumber?: boolean;
  };

  openedGame?: {
    url: string;
    chatId: string;
    messageId: number;
  };

  requestedDraft?: {
    chatId?: string;
    text: string;
  };

  pollModal: {
    isOpen: boolean;
    isQuiz?: boolean;
  };

  webApp?: {
    url: string;
    botId: string;
    buttonText: string;
    queryId?: string;
    slug?: string;
  };

  trustedBotIds: string[];
  botTrustRequest?: {
    botId: string;
    type: 'game' | 'webApp';
    onConfirm?: {
      action: keyof GlobalActions;
      payload: any; // TODO Add TS support
    };
  };
  requestedAttachBotInstall?: {
    botId: string;
    onConfirm?: {
      action: keyof GlobalActions;
      payload: any; // TODO Add TS support
    };
  };
  requestedAttachBotInChat?: {
    botId: string;
    filter: ApiChatType[];
    startParam?: string;
  };

  attachMenu: {
    hash?: string;
    bots: Record<string, ApiAttachBot>;
  };

  confetti?: {
    lastConfettiTime?: number;
    top?: number;
    left?: number;
    width?: number;
    height?: number;
  };

  urlAuth?: {
    button?: {
      chatId: string;
      messageId: number;
      buttonId: number;
    };
    request?: {
      domain: string;
      botId: string;
      shouldRequestWriteAccess?: boolean;
    };
    url: string;
  };

  premiumModal?: {
    isOpen?: boolean;
    isClosing?: boolean;
    promo: ApiPremiumPromo;
    initialSection?: string;
    fromUserId?: string;
    toUserId?: string;
    isGift?: boolean;
    monthsAmount?: number;
    isSuccess?: boolean;
  };

  giftPremiumModal?: {
    isOpen?: boolean;
    forUserId?: string;
    monthlyCurrency?: string;
    monthlyAmount?: string;
  };

  transcriptions: Record<string, ApiTranscription>;

  limitReachedModal?: {
    limit: ApiLimitTypeWithModal;
  };

  deleteFolderDialogModal?: number;
};

export type CallSound = (
  'join' | 'allowTalk' | 'leave' | 'connecting' | 'incoming' | 'end' | 'connect' | 'busy' | 'ringing'
);

export interface ActionPayloads {
  // Initial
  signOut: { forceInitApi?: boolean } | undefined;
  apiUpdate: ApiUpdate;

  // Misc
  setInstallPrompt: { canInstall: boolean };
  openLimitReachedModal: { limit: ApiLimitTypeWithModal };
  closeLimitReachedModal: never;
  checkAppVersion: never;

  // Accounts
  reportPeer: {
    chatId?: string;
    reason: ApiReportReason;
    description: string;
  };
  reportProfilePhoto: {
    chatId?: string;
    reason: ApiReportReason;
    description: string;
    photo?: ApiPhoto;
  };
  changeSessionSettings: {
    hash: string;
    areCallsEnabled?: boolean;
    areSecretChatsEnabled?: boolean;
  };
  changeSessionTtl: {
    days: number;
  };

  // Chats
  openChat: {
    id: string | undefined;
    threadId?: number;
    type?: MessageListType;
    shouldReplaceHistory?: boolean;
  };

  openChatWithDraft: {
    chatId?: string;
    text: string;
  };
  resetOpenChatWithDraft: never;

  toggleJoinToSend: {
    chatId: string;
    isEnabled: boolean;
  };

  toggleJoinRequest: {
    chatId: string;
    isEnabled: boolean;
  };

  // Messages
  setEditingDraft: {
    text?: ApiFormattedText;
    chatId: string;
    threadId: number;
    type: MessageListType;
  };
  fetchUnreadMentions: {
    chatId: string;
    offsetId?: number;
  };
  fetchUnreadReactions: {
    chatId: string;
    offsetId?: number;
  };
  animateUnreadReaction: {
    messageIds: number[];
  };
  focusNextReaction: never;
  focusNextMention: never;
  readAllReactions: never;
  readAllMentions: never;
  markMentionsRead: {
    messageIds: number[];
  };

  sendPollVote: {
    chatId: string;
    messageId: number;
    options: string[];
  };
  cancelPollVote: {
    chatId: string;
    messageId: number;
  };
  closePoll: {
    chatId: string;
    messageId: number;
  };

  loadExtendedMedia: {
    chatId: string;
    ids: number[];
  };

  // Media Viewer & Audio Player
  openMediaViewer: {
    chatId?: string;
    threadId?: number;
    mediaId?: number;
    avatarOwnerId?: string;
    profilePhotoIndex?: number;
    origin?: MediaViewerOrigin;
    volume?: number;
    playbackRate?: number;
    isMuted?: boolean;
  };
  closeMediaViewer: never;
  setMediaViewerVolume: {
    volume: number;
  };
  setMediaViewerPlaybackRate: {
    playbackRate: number;
  };
  setMediaViewerMuted: {
    isMuted: boolean;
  };
  setMediaViewerHidden: boolean;
  openAudioPlayer: {
    chatId: string;
    threadId?: number;
    messageId: number;
    origin?: AudioOrigin;
    volume?: number;
    playbackRate?: number;
    isMuted?: boolean;
  };
  closeAudioPlayer: never;
  setAudioPlayerVolume: {
    volume: number;
  };
  setAudioPlayerPlaybackRate: {
    playbackRate: number;
  };
  setAudioPlayerMuted: {
    isMuted: boolean;
  };
  setAudioPlayerOrigin: {
    origin: AudioOrigin;
  };

  // Downloads
  downloadSelectedMessages: never;
  downloadMessageMedia: {
    message: ApiMessage;
  };
  cancelMessageMediaDownload: {
    message: ApiMessage;
  };
  cancelMessagesMediaDownload: {
    messages: ApiMessage[];
  };

  // Users
  openAddContactDialog: {
    userId?: string;
  };
  openNewContactDialog: undefined;
  closeNewContactDialog: undefined;
  importContact: {
    phoneNumber: string;
    firstName: string;
    lastName?: string;
  };
  updateContact: {
    userId: string;
    firstName: string;
    lastName?: string;
    isMuted?: boolean;
    shouldSharePhoneNumber?: boolean;
  };

  // Forwards
  openForwardMenu: {
    fromChatId: string;
    messageIds?: number[];
    groupedId?: string;
    withMyScore?: boolean;
  };
  openForwardMenuForSelectedMessages: never;
  setForwardChatId: {
    id: string;
  };
  forwardMessages: {
    isSilent?: boolean;
    scheduledAt?: number;
  };
  setForwardNoAuthors: boolean;
  setForwardNoCaptions: boolean;
  exitForwardMode: never;
  changeForwardRecipient: never;
  forwardToSavedMessages: never;

  // GIFs
  loadSavedGifs: never;

  // Stickers
  loadStickers: {
    stickerSetInfo: ApiStickerSetInfo;
  };
  loadAnimatedEmojis: never;
  loadGreetingStickers: never;

  addRecentSticker: {
    sticker: ApiSticker;
  };

  removeRecentSticker: {
    sticker: ApiSticker;
  };

  clearRecentStickers: never;

  loadStickerSets: never;
  loadAddedStickers: never;
  loadRecentStickers: never;
  loadFavoriteStickers: never;
  loadFeaturedStickers: never;

  reorderStickerSets: {
    isCustomEmoji?: boolean;
    order: string[];
  };

  addNewStickerSet: {
    stickerSet: ApiStickerSet;
  };

  openStickerSet: {
    stickerSetInfo: ApiStickerSetInfo;
  };
  closeStickerSetModal: never;

  loadStickersForEmoji: {
    emoji: string;
  };
  clearStickersForEmoji: never;

  loadCustomEmojiForEmoji: {
    emoji: string;
  };
  clearCustomEmojiForEmoji: never;

  addRecentEmoji: {
    emoji: string;
  };

  loadCustomEmojis: {
    ids: string[];
    ignoreCache?: boolean;
  };
  updateLastRenderedCustomEmojis: {
    ids: string[];
  };
  openCustomEmojiSets: {
    setIds: string[];
  };
  closeCustomEmojiSets: never;
  addRecentCustomEmoji: {
    documentId: string;
  };
  clearRecentCustomEmoji: never;
  loadFeaturedEmojiStickers: never;

  // Bots
  startBot: {
    botId: string;
    param?: string;
  };
  restartBot: {
    chatId: string;
  };

  clickBotInlineButton: {
    messageId: number;
    button: ApiKeyboardButton;
  };

  switchBotInline: {
    messageId: number;
    query: string;
    isSamePeer?: boolean;
  };

  openGame: {
    url: string;
    chatId: string;
    messageId: number;
  };
  closeGame: never;

  requestWebView: {
    url?: string;
    botId: string;
    peerId: string;
    theme?: ApiThemeParameters;
    isSilent?: boolean;
    buttonText: string;
    isFromBotMenu?: boolean;
    startParam?: string;
  };
  prolongWebView: {
    botId: string;
    peerId: string;
    queryId: string;
    isSilent?: boolean;
    replyToMessageId?: number;
  };
  requestSimpleWebView: {
    url: string;
    botId: string;
    buttonText: string;
    theme?: ApiThemeParameters;
  };
  closeWebApp: never;
  setWebAppPaymentSlug: {
    slug?: string;
  };

  cancelBotTrustRequest: never;
  markBotTrusted: {
    botId: string;
  };

  cancelAttachBotInstall: never;
  confirmAttachBotInstall: never;

  processAttachBotParameters: {
    username: string;
    filter: ApiChatType[];
    startParam?: string;
  };
  requestAttachBotInChat: {
    botId: string;
    filter: ApiChatType[];
    startParam?: string;
  };
  cancelAttachBotInChat: never;

  sendWebViewData: {
    bot: ApiUser;
    data: string;
    buttonText: string;
  };

  loadAttachBots: {
    hash?: string;
  };

  toggleAttachBot: {
    botId: string;
    isEnabled: boolean;
  };

  callAttachBot: {
    chatId: string;
    botId: string;
    isFromBotMenu?: boolean;
    url?: string;
    startParam?: string;
  };

  requestBotUrlAuth: {
    chatId: string;
    messageId: number;
    buttonId: number;
    url: string;
  };

  acceptBotUrlAuth: {
    isWriteAllowed?: boolean;
  };

  requestLinkUrlAuth: {
    url: string;
  };

  acceptLinkUrlAuth: {
    isWriteAllowed?: boolean;
  };

  // Settings
  loadAuthorizations: never;
  terminateAuthorization: {
    hash: string;
  };
  terminateAllAuthorizations: never;

  loadWebAuthorizations: never;
  terminateWebAuthorization: {
    hash: string;
  };
  terminateAllWebAuthorizations: never;

  // Misc
  openPollModal: {
    isQuiz?: boolean;
  };
  closePollModal: never;
  requestConfetti: {
    top: number;
    left: number;
    width: number;
    height: number;
  } | undefined;

  openUrl: {
    url: string;
    shouldSkipModal?: boolean;
  };
  toggleSafeLinkModal: {
    url?: string;
  };
  closeUrlAuthModal: never;
  showNotification: {
    localId?: string;
    title?: string;
    message: string;
    className?: string;
    actionText?: string;
    action?: NoneToVoidFunction;
  };
  dismissNotification: { localId: string };

  // Calls
  requestCall: {
    userId: string;
    isVideo?: boolean;
  };
  sendSignalingData: P2pMessage;
  hangUp: never;
  acceptCall: never;
  setCallRating: {
    rating: number;
    comment: string;
  };
  closeCallRatingModal: never;
  playGroupCallSound: {
    sound: CallSound;
  };
  connectToActivePhoneCall: never;

  // Passcode
  setPasscode: { passcode: string };
  clearPasscode: never;
  lockScreen: never;
  unlockScreen: { sessionJson: string; globalJson: string };
  softSignIn: never;
  logInvalidUnlockAttempt: never;
  resetInvalidUnlockAttempts: never;
  setPasscodeError: { error: string };
  clearPasscodeError: never;
  skipLockOnUnload: never;

  // Settings
  requestNextSettingsScreen: SettingsScreens;
  sortChatFolders: { folderIds: number[] };
  closeDeleteChatFolderModal: never;
  openDeleteChatFolderModal: { folderId: number };
  loadGlobalPrivacySettings: never;
  updateGlobalPrivacySettings: { shouldArchiveAndMuteNewNonContact: boolean };

  // Premium
  openPremiumModal: {
    initialSection?: string;
    fromUserId?: string;
    toUserId?: string;
    isSuccess?: boolean;
    isGift?: boolean;
    monthsAmount?: number;
  };
  closePremiumModal: never | {
    isClosed?: boolean;
  };

  transcribeAudio: {
    chatId: string;
    messageId: number;
  };

  loadPremiumGifts: never;
  loadPremiumStickers: {
    hash?: string;
  };
  loadPremiumSetStickers: {
    hash?: string;
  };

  openGiftPremiumModal: {
    forUserId?: string;
  };

  closeGiftPremiumModal: never;

  // Invoice
  openInvoice: ApiInputInvoice;

  // Payment
  validatePaymentPassword: {
    password: string;
  };
}

export type NonTypedActionNames = (
  // system
  'init' | 'reset' | 'disconnect' | 'initApi' | 'sync' | 'saveSession' |
  'showDialog' | 'dismissDialog' |
  // ui
  'toggleChatInfo' | 'setIsUiReady' | 'toggleLeftColumn' |
  'toggleSafeLinkModal' | 'openHistoryCalendar' | 'closeHistoryCalendar' | 'disableContextMenuHint' |
  'setNewChatMembersDialogState' | 'disableHistoryAnimations' | 'setLeftColumnWidth' | 'resetLeftColumnWidth' |
  'openSeenByModal' | 'closeSeenByModal' | 'closeReactorListModal' | 'openReactorListModal' |
  'toggleStatistics' | 'toggleMessageStatistics' |
  // auth
  'setAuthPhoneNumber' | 'setAuthCode' | 'setAuthPassword' | 'signUp' | 'returnToAuthPhoneNumber' |
  'setAuthRememberMe' | 'clearAuthError' | 'uploadProfilePhoto' | 'goToAuthQrCode' | 'clearCache' |
  // chats
  'preloadTopChatMessages' | 'loadAllChats' | 'openChatWithInfo' | 'openLinkedChat' |
  'openSupportChat' | 'focusMessageInComments' | 'openChatByPhoneNumber' |
  'loadChatSettings' | 'loadFullChat' | 'loadTopChats' | 'requestChatUpdate' | 'updateChatMutedState' |
  'joinChannel' | 'leaveChannel' | 'deleteChannel' | 'toggleChatPinned' | 'toggleChatArchived' | 'toggleChatUnread' |
  'loadChatFolders' | 'loadRecommendedChatFolders' | 'editChatFolder' | 'addChatFolder' | 'deleteChatFolder' |
  'updateChat' | 'toggleSignatures' | 'loadGroupsForDiscussion' | 'linkDiscussionGroup' | 'unlinkDiscussionGroup' |
  'loadProfilePhotos' | 'loadMoreMembers' | 'setActiveChatFolder' | 'openNextChat' | 'setChatEnabledReactions' |
  'addChatMembers' | 'deleteChatMember' | 'openPreviousChat' | 'editChatFolders' | 'toggleIsProtected' |
  // messages
  'loadViewportMessages' | 'selectMessage' | 'sendMessage' | 'cancelSendingMessage' | 'pinMessage' | 'deleteMessages' |
  'markMessageListRead' | 'markMessagesRead' | 'loadMessage' | 'focusMessage' | 'focusLastMessage' |
  'editMessage' | 'deleteHistory' | 'enterMessageSelectMode' | 'toggleMessageSelection' | 'exitMessageSelectMode' |
  'openTelegramLink' | 'openChatByUsername' | 'requestThreadInfoUpdate' | 'setScrollOffset' | 'unpinAllMessages' |
  'setReplyingToId' | 'editLastMessage' | 'saveDraft' | 'clearDraft' | 'loadPinnedMessages' |
  'toggleMessageWebPage' | 'replyToNextMessage' | 'deleteChatUser' | 'deleteChat' | 'sendReaction' |
  'reportMessages' | 'sendMessageAction' | 'focusNextReply' | 'openChatByInvite' | 'loadSeenBy' |
  'loadSponsoredMessages' | 'viewSponsoredMessage' | 'loadSendAs' | 'saveDefaultSendAs' | 'loadAvailableReactions' |
  'stopActiveEmojiInteraction' | 'interactWithAnimatedEmoji' | 'loadReactors' | 'setDefaultReaction' |
  'sendDefaultReaction' | 'sendEmojiInteraction' | 'sendWatchingEmojiInteraction' | 'loadMessageReactions' |
  'stopActiveReaction' | 'copySelectedMessages' | 'copyMessagesByIds' |
  'setEditingId' |
  // scheduled messages
  'loadScheduledHistory' | 'sendScheduledMessages' | 'rescheduleMessage' | 'deleteScheduledMessages' |
  // poll result
  'openPollResults' | 'closePollResults' | 'loadPollOptionResults' |
  // global search
  'setGlobalSearchQuery' | 'searchMessagesGlobal' | 'addRecentlyFoundChatId' | 'clearRecentlyFoundChats' |
  'setGlobalSearchContent' | 'setGlobalSearchChatId' | 'setGlobalSearchDate' |
  // message search
  'openLocalTextSearch' | 'closeLocalTextSearch' | 'setLocalTextSearchQuery' | 'setLocalMediaSearchType' |
  'searchTextMessagesLocal' | 'searchMediaMessagesLocal' | 'searchMessagesByDate' |
  // management
  'toggleManagement' | 'closeManagement' | 'checkPublicLink' | 'updatePublicLink' | 'updatePrivateLink' |
  'setEditingExportedInvite' | 'loadExportedChatInvites' | 'editExportedChatInvite' | 'exportChatInvite' |
  'deleteExportedChatInvite' | 'deleteRevokedExportedChatInvites' | 'setOpenedInviteInfo' | 'loadChatInviteImporters' |
  'loadChatJoinRequests' | 'hideChatJoinRequest' | 'hideAllChatJoinRequests' | 'requestNextManagementScreen' |
  'loadChatInviteRequesters' | 'hideChatReportPanel' |
  // groups
  'togglePreHistoryHidden' | 'updateChatDefaultBannedRights' | 'updateChatMemberBannedRights' | 'updateChatAdmin' |
  'acceptInviteConfirmation' |
  // users
  'loadFullUser' | 'loadNearestCountry' | 'loadTopUsers' | 'loadContactList' |
  'loadCurrentUser' | 'updateProfile' | 'checkUsername' |
  'deleteContact' | 'loadUser' | 'setUserSearchQuery' | 'loadCommonChats' | 'reportSpam' |
  // chat creation
  'createChannel' | 'createGroupChat' | 'resetChatCreation' |
  // settings
  'setSettingOption' | 'loadPasswordInfo' | 'clearTwoFaError' |
  'updatePassword' | 'updateRecoveryEmail' | 'clearPassword' | 'provideTwoFaEmailCode' | 'checkPassword' |
  'loadBlockedContacts' | 'blockContact' | 'unblockContact' |
  'loadNotificationSettings' | 'updateContactSignUpNotification' | 'updateNotificationSettings' |
  'updateWebNotificationSettings' | 'loadLanguages' | 'loadPrivacySettings' | 'setPrivacyVisibility' |
  'setPrivacySettings' | 'loadNotificationExceptions' | 'setThemeSettings' | 'updateIsOnline' |
  'loadContentSettings' | 'updateContentSettings' |
  'loadCountryList' | 'ensureTimeFormat' | 'loadAppConfig' |
  // stickers & GIFs
  'setStickerSearchQuery' | 'saveGif' | 'setGifSearchQuery' | 'searchMoreGifs' |
  'faveSticker' | 'unfaveSticker' | 'toggleStickerSet' |
  'loadEmojiKeywords' |
  // bots
  'sendBotCommand' | 'loadTopInlineBots' | 'queryInlineBot' | 'sendInlineBotResult' |
  'resetInlineBot' |
  // misc
  'loadWebPagePreview' | 'clearWebPagePreview' | 'loadWallpapers' | 'uploadWallpaper' |
  'setDeviceToken' | 'deleteDeviceToken' |
  'checkVersionNotification' | 'createServiceNotification' |
  // payment
  'closePaymentModal' | 'addPaymentError' | 'validateRequestedInfo' | 'setPaymentStep' | 'sendPaymentForm' |
  'getReceipt' | 'sendCredentialsInfo' | 'clearPaymentError' | 'clearReceipt' |
  // calls
  'joinGroupCall' | 'toggleGroupCallMute' | 'toggleGroupCallPresentation' | 'leaveGroupCall' |
  'toggleGroupCallVideo' | 'requestToSpeak' | 'setGroupCallParticipantVolume' | 'toggleGroupCallPanel' |
  'createGroupCall' | 'joinVoiceChatByLink' | 'subscribeToGroupCallUpdates' | 'createGroupCallInviteLink' |
  'loadMoreGroupCallParticipants' | 'connectToActiveGroupCall' |
  // stats
  'loadStatistics' | 'loadMessageStatistics' | 'loadStatisticsAsyncGraph'
);

const typed = typify<GlobalState, ActionPayloads, NonTypedActionNames>();
export type GlobalActions = ReturnType<typeof typed.getActions>;
