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
  ApiConfig,
  ApiReaction,
  ApiChatReactions,
  ApiContact,
  ApiExportedInvite,
  ApiSendMessageAction,
  ApiMessageEntity,
  ApiAttachment,
  ApiChatBannedRights,
  ApiChatAdminRights,
  ApiSessionData,
  ApiTypingStatus,
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
  ManagementScreens,
  LoadMoreDirection, PrivacyVisibility,
} from '../types';
import { typify } from '../lib/teact/teactn';
import type { P2pMessage } from '../lib/secret-sauce';
import type { ApiCredentials } from '../components/payment/PaymentModal';

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

export type ApiPaymentStatus = 'paid' | 'failed' | 'pending' | 'cancelled';

export interface ActiveReaction {
  messageId?: number;
  reaction?: ApiReaction;
}

export interface TabThread {
  scrollOffset?: number;
  replyStack?: number[];
  outlyingIds?: number[];
  viewportIds?: number[];
}

export interface Thread {
  lastScrollOffset?: number;
  lastViewportIds?: number[];
  listedIds?: number[];
  pinnedIds?: number[];
  scheduledIds?: number[];
  editingId?: number;
  replyingToId?: number;
  editingScheduledId?: number;
  editingDraft?: ApiFormattedText;
  editingScheduledDraft?: ApiFormattedText;
  draft?: ApiDraft;
  noWebPage?: boolean;
  threadInfo?: ApiThreadInfo;
  firstMessageId?: number;
  typingStatus?: ApiTypingStatus;
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

export type TabState = {
  id: number;
  isMasterTab: boolean;
  isInactive?: boolean;
  inviteHash?: string;
  canInstall?: boolean;
  isChatInfoShown: boolean;
  isStatisticsShown?: boolean;
  isLeftColumnShown: boolean;
  newChatMembersProgress?: NewChatMembersProgress;
  uiReadyState: 0 | 1 | 2;
  shouldInit: boolean;
  shouldSkipHistoryAnimations?: boolean;

  gifSearch: {
    query?: string;
    offset?: string;
    results?: ApiVideo[];
  };

  stickerSearch: {
    query?: string;
    hash?: string;
    resultIds?: string[];
  };

  nextSettingsScreen?: SettingsScreens;

  isCallPanelVisible?: boolean;
  multitabNextAction?: CallbackAction;
  ratingPhoneCall?: ApiPhoneCall;

  messageLists: MessageList[];

  contentToBeScheduled?: {
    gif?: ApiVideo;
    sticker?: ApiSticker;
    poll?: ApiNewPoll;
    isSilent?: boolean;
    sendGrouped?: boolean;
    sendCompressed?: boolean;
  };

  activeChatFolder: number;
  tabThreads: Record<string, Record<number, TabThread>>;
  forumPanelChatId?: string;

  focusedMessage?: {
    chatId?: string;
    threadId?: number;
    messageId?: number;
    direction?: FocusDirection;
    noHighlight?: boolean;
    isResizingContainer?: boolean;
    hasReachedMessage?: boolean;
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

  inlineBots: {
    isLoading: boolean;
    byUsername: Record<string, false | InlineBotSettings>;
  };

  globalSearch: {
    query?: string;
    date?: number;
    currentContent?: GlobalSearchContent;
    chatId?: string;
    foundTopicIds?: number[];
    fetchingStatus?: {
      chats?: boolean;
      messages?: boolean;
    };
    isClosing?: boolean;
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

  activeEmojiInteractions?: ActiveEmojiInteraction[];
  activeReactions: Record<number, ActiveReaction[]>;

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
    byChatThreadKey: Record<string, {
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
    isPlaybackRateActive?: boolean;
    isMuted: boolean;
  };

  webPagePreview?: ApiWebPage;

  forwardMessages: {
    isModalShown?: boolean;
    fromChatId?: string;
    messageIds?: number[];
    toChatId?: string;
    toThreadId?: number;
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
    status?: ApiPaymentStatus;
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
    error?: string;
  };

  notifications: ApiNotification[];
  dialogs: (ApiError | ApiInviteInfo | ApiContact)[];

  safeLinkModalUrl?: string;
  historyCalendarSelectedAt?: number;
  openedStickerSetShortName?: string;
  openedCustomEmojiSetIds?: string[];

  activeDownloads: {
    byChatId: Record<string, number[]>;
  };

  shouldShowContextMenuHint?: boolean;

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
    files?: File[];
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
    replyToMessageId?: number;
    threadId?: number;
  };

  botTrustRequest?: {
    botId: string;
    type: 'game' | 'webApp';
    onConfirm?: CallbackAction;
  };
  requestedAttachBotInstall?: {
    bot: ApiAttachBot;
    onConfirm?: CallbackAction;
  };
  requestedAttachBotInChat?: {
    bot: ApiAttachBot;
    filter: ApiChatType[];
    startParam?: string;
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

  limitReachedModal?: {
    limit: ApiLimitTypeWithModal;
  };

  deleteFolderDialogModal?: number;

  createTopicPanel?: {
    chatId: string;
    isLoading?: boolean;
  };

  editTopicPanel?: {
    chatId: string;
    topicId: number;
    isLoading?: boolean;
  };
};

export type GlobalState = {
  config?: ApiConfig;
  appConfig?: ApiAppConfig;
  hasWebAuthTokenFailed?: boolean;
  hasWebAuthTokenPasswordRequired?: true;
  connectionState?: ApiUpdateConnectionStateType;
  currentUserId?: string;
  isSyncing?: boolean;
  isUpdateAvailable?: boolean;
  lastSyncTime?: number;
  serverTimeOffset: number;
  blurredTabTokens: number[];
  leftColumnWidth?: number;
  lastIsChatInfoShown?: boolean;
  initialUnreadNotifications?: number;
  notificationIndex?: number;
  allNotificationsCount?: number;

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
    error?: string;
    waitingEmailCodeLength?: number;
  };

  attachmentSettings: {
    shouldCompress: boolean;
    shouldSendGrouped: boolean;
  };

  attachMenu: {
    hash?: string;
    bots: Record<string, ApiAttachBot>;
  };

  passcode: {
    isScreenLocked?: boolean;
    hasPasscode?: boolean;
    error?: string;
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
    sponsoredByChatId: Record<string, ApiSponsoredMessage>;
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

  chatFolders: {
    orderedIds?: number[];
    byId: Record<number, ApiChatFolder>;
    recommended?: ApiChatFolder[];
  };

  phoneCall?: ApiPhoneCall;

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
    statusRecent: {
      hash?: string;
      emojis?: ApiSticker[];
    };
  };

  animatedEmojis?: ApiStickerSet;
  animatedEmojiEffects?: ApiStickerSet;
  genericEmojiEffects?: ApiStickerSet;
  defaultTopicIconsId?: string;
  defaultStatusIconsId?: string;
  premiumGifts?: ApiStickerSet;
  emojiKeywords: Partial<Record<LangCode, EmojiKeywords>>;

  gifs: {
    saved: {
      hash?: string;
      gifs?: ApiVideo[];
    };
  };

  availableReactions?: ApiAvailableReaction[];

  topPeers: {
    userIds?: string[];
    lastRequestedAt?: number;
  };

  topInlineBots: {
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
    loadedWallpapers?: ApiWallpaper[];
    themes: Partial<Record<ThemeKey, IThemeSettings>>;
    privacy: Partial<Record<ApiPrivacyKey, ApiPrivacySettings>>;
    notifyExceptions?: Record<number, NotifyException>;
  };

  push?: {
    deviceToken: string;
    subscribedAt: number;
  };

  transcriptions: Record<string, ApiTranscription>;
  trustedBotIds: string[];

  serviceNotifications: ServiceNotification[];

  byTabId: Record<number, TabState>;
};

export type CallSound = (
  'join' | 'allowTalk' | 'leave' | 'connecting' | 'incoming' | 'end' | 'connect' | 'busy' | 'ringing'
);

export interface RequiredActionPayloads {
  apiUpdate: ApiUpdate;
}

type Values<T> = T[keyof T];
export type CallbackAction = Values<{
  [ActionName in keyof (ActionPayloads)]: {
    action: ActionName;
    payload: (ActionPayloads)[ActionName];
  }
}>;

export type ApiDraft = ApiFormattedText & { isLocal?: boolean };

type WithTabId = { tabId?: number };

export interface ActionPayloads {
  // system
  init: ({
    isMasterTab?: boolean;
  } & WithTabId) | undefined;
  reset: undefined;
  disconnect: undefined;
  initApi: undefined;
  sync: undefined;
  saveSession: {
    sessionData?: ApiSessionData;
  };

  // auth
  setAuthPhoneNumber: { phoneNumber: string };
  setAuthCode: { code: string };
  setAuthPassword: { password: string };
  signUp: {
    firstName: string;
    lastName: string;
  };
  returnToAuthPhoneNumber: undefined;
  setAuthRememberMe: boolean;
  clearAuthError: undefined;
  uploadProfilePhoto: {
    file: File;
    isFallback?: boolean;
    videoTs?: number;
    isVideo?: boolean;
  };
  goToAuthQrCode: undefined;

  // stickers & GIFs
  setStickerSearchQuery: { query?: string } & WithTabId;
  saveGif: {
    gif: ApiVideo;
    shouldUnsave?: boolean;
  } & WithTabId;
  setGifSearchQuery: { query?: string } & WithTabId;
  searchMoreGifs: WithTabId | undefined;
  faveSticker: { sticker: ApiSticker } & WithTabId;
  unfaveSticker: { sticker: ApiSticker };
  toggleStickerSet: { stickerSetId: string };
  loadEmojiKeywords: { language: LangCode };

  // groups
  togglePreHistoryHidden: {
    chatId: string;
    isEnabled: boolean;
  } & WithTabId;
  updateChatDefaultBannedRights: {
    chatId: string;
    bannedRights: ApiChatBannedRights;
  };
  updateChatMemberBannedRights: {
    chatId: string;
    userId: string;
    bannedRights: ApiChatBannedRights;
  } & WithTabId;
  updateChatAdmin: {
    chatId: string;
    userId: string;
    adminRights: ApiChatAdminRights;
    customTitle?: string;
  } & WithTabId;
  acceptInviteConfirmation: { hash: string } & WithTabId;

  // settings
  setSettingOption: Partial<ISettings> | undefined;
  loadPasswordInfo: undefined;
  clearTwoFaError: undefined;
  updatePassword: {
    currentPassword: string;
    password: string;
    hint?: string;
    email?: string;
    onSuccess: VoidFunction;
  };
  updateRecoveryEmail: {
    currentPassword: string;
    email: string;
    onSuccess: VoidFunction;
  };
  clearPassword: {
    currentPassword: string;
    onSuccess: VoidFunction;
  };
  provideTwoFaEmailCode: {
    code: string;
  };
  checkPassword: {
    currentPassword: string;
    onSuccess: VoidFunction;
  };
  loadBlockedContacts: undefined;
  blockContact: {
    contactId: string;
    accessHash: string;
  };
  unblockContact: {
    contactId: string;
  };

  loadNotificationSettings: undefined;
  updateContactSignUpNotification: {
    isSilent: boolean;
  };
  updateNotificationSettings: {
    peerType: 'contact' | 'group' | 'broadcast';
    isSilent?: boolean;
    shouldShowPreviews?: boolean;
  };

  updateWebNotificationSettings: {
    hasWebNotifications?: boolean;
    hasPushNotifications?: boolean;
    notificationSoundVolume?: number;
  };
  loadLanguages: undefined;
  loadPrivacySettings: undefined;
  setPrivacyVisibility: {
    privacyKey: ApiPrivacyKey;
    visibility: PrivacyVisibility;
  };

  setPrivacySettings: {
    privacyKey: ApiPrivacyKey;
    isAllowList: boolean;
    contactsIds: string[];
  };
  loadNotificationExceptions: undefined;
  setThemeSettings: { theme: ThemeKey } & Partial<IThemeSettings>;
  updateIsOnline: boolean;

  loadContentSettings: undefined;
  updateContentSettings: boolean;

  loadCountryList: {
    langCode?: LangCode;
  };
  ensureTimeFormat: WithTabId | undefined;

  // misc
  loadWebPagePreview: {
    text: string;
  } & WithTabId;
  clearWebPagePreview: WithTabId | undefined;
  loadWallpapers: undefined;
  uploadWallpaper: File;
  setDeviceToken: string;
  deleteDeviceToken: undefined;
  checkVersionNotification: undefined;
  createServiceNotification: {
    message: ApiMessage;
    version?: string;
  };

  // message search
  openLocalTextSearch: WithTabId | undefined;
  closeLocalTextSearch: WithTabId | undefined;
  setLocalTextSearchQuery: {
    query?: string;
  } & WithTabId;
  setLocalMediaSearchType: {
    mediaType: SharedMediaType;
  } & WithTabId;
  searchTextMessagesLocal: WithTabId | undefined;
  searchMediaMessagesLocal: WithTabId | undefined;
  searchMessagesByDate: {
    timestamp: number;
  } & WithTabId;

  toggleChatInfo: ({ force?: boolean } & WithTabId) | undefined;
  setIsUiReady: {
    uiReadyState: 0 | 1 | 2;
  } & WithTabId;
  toggleLeftColumn: WithTabId | undefined;

  addChatMembers: {
    chatId: string;
    memberIds: string[];
  } & WithTabId;
  deleteChatMember: {
    chatId: string;
    userId: string;
  } & WithTabId;
  openPreviousChat: WithTabId | undefined;
  editChatFolders: {
    chatId: string;
    idsToRemove: number[];
    idsToAdd: number[];
  } & WithTabId;
  toggleIsProtected: {
    chatId: string;
    isProtected: boolean;
  };
  preloadTopChatMessages: undefined;
  loadAllChats: {
    listType: 'active' | 'archived';
    onReplace?: VoidFunction;
    shouldReplace?: boolean;
  };
  openChatWithInfo: ActionPayloads['openChat'] & WithTabId;
  openLinkedChat: { id: string } & WithTabId;
  loadMoreMembers: WithTabId | undefined;
  setActiveChatFolder: {
    activeChatFolder: number;
  } & WithTabId;
  openNextChat: {
    orderedIds: string[];
    targetIndexDelta: number;
  } & WithTabId;
  joinChannel: {
    chatId: string;
  } & WithTabId;
  leaveChannel: { chatId: string } & WithTabId;
  deleteChannel: { chatId: string } & WithTabId;
  toggleChatPinned: {
    id: string;
    folderId: number;
  } & WithTabId;
  toggleChatArchived: {
    id: string;
  };
  toggleChatUnread: { id: string };
  loadChatFolders: undefined;
  loadRecommendedChatFolders: undefined;
  editChatFolder: {
    id: number;
    folderUpdate: Omit<ApiChatFolder, 'id' | 'description' | 'emoticon'>;
  };
  addChatFolder: {
    folder: ApiChatFolder;
  } & WithTabId;
  deleteChatFolder: {
    id: number;
  };
  openSupportChat: WithTabId | undefined;
  focusMessageInComments: {
    chatId: string;
    threadId: number;
    messageId: number;
  } & WithTabId;
  openChatByPhoneNumber: {
    phoneNumber: string;
    startAttach?: string | boolean;
    attach?: string;
  } & WithTabId;
  openChatByInvite: {
    hash: string;
  } & WithTabId;

  // global search
  setGlobalSearchQuery: {
    query?: string;
  } & WithTabId;
  searchMessagesGlobal: {
    type: ApiGlobalMessageSearchType;
  } & WithTabId;
  addRecentlyFoundChatId: {
    id: string;
  };
  clearRecentlyFoundChats: undefined;
  setGlobalSearchContent: {
    content?: GlobalSearchContent;
  } & WithTabId;
  setGlobalSearchChatId: {
    id?: string;
  } & WithTabId;
  setGlobalSearchDate: {
    date?: number;
  } & WithTabId;

  // scheduled messages
  loadScheduledHistory: {
    chatId: string;
  };
  sendScheduledMessages: {
    chatId: string;
    id: number;
  };
  rescheduleMessage: {
    chatId: string;
    messageId: number;
    scheduledAt: number;
  };
  deleteScheduledMessages: { messageIds: number[] } & WithTabId;
  // Message
  loadViewportMessages: {
    direction?: LoadMoreDirection;
    isBudgetPreload?: boolean;
    chatId?: string;
    threadId?: number;
  } & WithTabId;
  sendMessage: {
    text?: string;
    entities?: ApiMessageEntity[];
    attachments?: ApiAttachment[];
    sticker?: ApiSticker;
    isSilent?: boolean;
    scheduledAt?: number;
    gif?: ApiVideo;
    poll?: ApiNewPoll;
    contact?: Partial<ApiContact>;
    shouldUpdateStickerSetsOrder?: boolean;
    shouldGroupMessages?: boolean;
  } & WithTabId;
  cancelSendingMessage: {
    chatId: string;
    messageId: number;
  };
  pinMessage: {
    messageId: number;
    isUnpin: boolean;
    isOneSide?: boolean;
    isSilent?: boolean;
  } & WithTabId;
  deleteMessages: {
    messageIds: number[];
    shouldDeleteForAll?: boolean;
  } & WithTabId;
  markMessageListRead: {
    maxId: number;
  } & WithTabId;
  markMessagesRead: {
    messageIds: number[];
  } & WithTabId;
  loadMessage: {
    chatId: string;
    messageId: number;
    replyOriginForId?: number;
    threadUpdate?: {
      lastMessageId: number;
      isDeleting?: boolean;
    };
  };
  editMessage: {
    text: string;
    entities?: ApiMessageEntity[];
  } & WithTabId;
  deleteHistory: {
    chatId: string;
    shouldDeleteForAll?: boolean;
  } & WithTabId;
  loadSponsoredMessages: {
    chatId: string;
  };
  viewSponsoredMessage: {
    chatId: string;
  };
  loadSendAs: {
    chatId: string;
  };
  saveDefaultSendAs: {
    chatId: string;
    sendAsId: string;
  };
  stopActiveEmojiInteraction: {
    id: number;
  } & WithTabId;
  interactWithAnimatedEmoji: {
    emoji: string;
    x: number;
    y: number;
    startSize: number;
    isReversed?: boolean;
  } & WithTabId;
  loadReactors: {
    chatId: string;
    messageId: number;
    reaction?: ApiReaction;
  };
  sendEmojiInteraction: {
    messageId: number;
    chatId: string;
    emoji: string;
    interactions: number[];
  };
  sendWatchingEmojiInteraction: {
    chatId: string;
    id: number;
    emoticon: string;
    x: number;
    y: number;
    startSize: number;
    isReversed?: boolean;
  } & WithTabId;
  reportMessages: {
    messageIds: number[];
    reason: ApiReportReason;
    description: string;
  } & WithTabId;
  sendMessageAction: {
    action: ApiSendMessageAction;
    chatId: string;
    threadId: number;
  };
  loadSeenBy: {
    chatId: string;
    messageId: number;
  };
  openTelegramLink: {
    url: string;
  } & WithTabId;
  openChatByUsername: {
    username: string;
    threadId?: number;
    messageId?: number;
    commentId?: number;
    startParam?: string;
    startAttach?: string | boolean;
    attach?: string;
  } & WithTabId;
  requestThreadInfoUpdate: {
    chatId: string;
    threadId: number;
  };
  setScrollOffset: {
    chatId: string;
    threadId: number;
    scrollOffset: number;
  } & WithTabId;
  unpinAllMessages: {
    chatId: string;
    threadId: number;
  };
  setEditingId: {
    messageId?: number;
  } & WithTabId;
  editLastMessage: WithTabId | undefined;
  saveDraft: {
    chatId: string;
    threadId: number;
    draft: ApiDraft;
  };
  clearDraft: {
    chatId: string;
    threadId?: number;
    localOnly?: boolean;
  };
  loadPinnedMessages: {
    chatId: string;
    threadId: number;
  };
  toggleMessageWebPage: {
    chatId: string;
    threadId: number;
    noWebPage?: boolean;
  };
  replyToNextMessage: {
    targetIndexDelta: number;
  } & WithTabId;
  deleteChatUser: { chatId: string; userId: string } & WithTabId;
  deleteChat: { chatId: string } & WithTabId;

  // chat creation
  createChannel: {
    title: string;
    about?: string;
    photo?: File;
    memberIds: string[];
  } & WithTabId;
  createGroupChat: {
    title: string;
    memberIds: string[];
    photo?: File;
  } & WithTabId;
  resetChatCreation: WithTabId | undefined;

  // payment
  closePaymentModal: WithTabId | undefined;
  addPaymentError: {
    error: TabState['payment']['error'];
  } & WithTabId;
  validateRequestedInfo: {
    requestInfo: any;
    saveInfo?: boolean;
  } & WithTabId;
  setPaymentStep: {
    step?: PaymentStep;
  } & WithTabId;
  sendPaymentForm: {
    shippingOptionId?: string;
    saveCredentials?: any;
    savedCredentialId?: string;
    tipAmount?: number;
  } & WithTabId;
  getReceipt: {
    receiptMessageId: number;
    chatId: string;
    messageId: number;
  } & WithTabId;
  sendCredentialsInfo: {
    credentials: ApiCredentials;
  } & WithTabId;
  clearPaymentError: WithTabId | undefined;
  clearReceipt: WithTabId | undefined;

  // stats
  toggleStatistics: WithTabId | undefined;
  toggleMessageStatistics: ({
    messageId?: number;
  } & WithTabId) | undefined;
  loadStatistics: {
    chatId: string;
    isGroup: boolean;
  } & WithTabId;
  loadMessageStatistics: {
    chatId: string;
    messageId: number;
  } & WithTabId;
  loadStatisticsAsyncGraph: {
    chatId: string;
    token: string;
    name: string;
    isPercentage?: boolean;
  } & WithTabId;

  // ui
  dismissDialog: WithTabId | undefined;
  setNewChatMembersDialogState: {
    newChatMembersProgress?: NewChatMembersProgress;
  } & WithTabId;
  disableHistoryAnimations: WithTabId | undefined;
  setLeftColumnWidth: {
    leftColumnWidth: number;
  };
  resetLeftColumnWidth: undefined;

  copySelectedMessages: WithTabId;
  copyMessagesByIds: {
    messageIds?: number[];
  } & WithTabId;
  openSeenByModal: {
    chatId: string;
    messageId: number;
  } & WithTabId;
  closeSeenByModal: WithTabId | undefined;
  closeReactorListModal: WithTabId | undefined;
  openReactorListModal: {
    chatId: string;
    messageId: number;
  } & WithTabId;
  enterMessageSelectMode: ({
    messageId: number;
  } & WithTabId) | undefined;
  toggleMessageSelection: {
    messageId: number;
    groupedId?: string;
    childMessageIds?: number[];
    withShift?: boolean;
  } & WithTabId;
  exitMessageSelectMode: WithTabId | undefined;
  openHistoryCalendar: {
    selectedAt?: number;
  } & WithTabId;
  closeHistoryCalendar: WithTabId | undefined;
  disableContextMenuHint: WithTabId | undefined;
  focusNextReply: WithTabId | undefined;

  // poll result
  openPollResults: {
    chatId: string;
    messageId: number;
  } & WithTabId;
  closePollResults: WithTabId | undefined;
  loadPollOptionResults: {
    chat: ApiChat;
    messageId: number;
    option: string;
    offset: string;
    limit: number;
    shouldResetVoters?: boolean;
  } & WithTabId;

  // management
  setEditingExportedInvite: { chatId: string; invite?: ApiExportedInvite } & WithTabId;
  loadExportedChatInvites: {
    chatId: string;
    adminId?: string;
    isRevoked?: boolean;
    limit?: number;
  } & WithTabId;
  editExportedChatInvite: {
    chatId: string;
    link: string;
    isRevoked?: boolean;
    expireDate?: number;
    usageLimit?: number;
    isRequestNeeded?: boolean;
    title?: string;
  } & WithTabId;
  exportChatInvite: {
    chatId: string;
    expireDate?: number;
    usageLimit?: number;
    isRequestNeeded?: boolean;
    title?: string;
  } & WithTabId;
  deleteExportedChatInvite: {
    chatId: string;
    link: string;
  } & WithTabId;
  deleteRevokedExportedChatInvites: {
    chatId: string;
    adminId?: string;
  } & WithTabId;
  setOpenedInviteInfo: { chatId: string; invite?: ApiExportedInvite } & WithTabId;
  loadChatInviteImporters: {
    chatId: string;
    link?: string;
    offsetDate?: number;
    offsetUserId?: string;
    limit?: number;
  } & WithTabId;
  hideChatJoinRequest: {
    chatId: string;
    userId: string;
    isApproved: boolean;
  };
  hideAllChatJoinRequests: {
    chatId: string;
    isApproved: boolean;
    link?: string;
  };
  loadChatInviteRequesters: {
    chatId: string;
    link?: string;
    offsetDate?: number;
    offsetUserId?: string;
    limit?: number;
  } & WithTabId;
  hideChatReportPanel: {
    chatId: string;
  };
  toggleManagement: WithTabId | undefined;
  requestNextManagementScreen: ({
    screen?: ManagementScreens;
  } & WithTabId) | undefined;
  closeManagement: WithTabId | undefined;
  checkPublicLink: { username: string } & WithTabId;
  updatePublicLink: { username: string } & WithTabId;
  updatePrivateLink: WithTabId | undefined;

  requestChatUpdate: { chatId: string };
  loadChatJoinRequests: {
    chatId: string;
    offsetDate?: number;
    offsetUserId?: string;
    limit?: number;
  };
  loadTopChats: undefined;
  showDialog: {
    data: TabState['dialogs'][number];
  } & WithTabId;
  setReachedFocusedMessage: {
    hasReached?: boolean;
  } & WithTabId;
  focusMessage: {
    chatId: string;
    threadId?: number;
    messageListType?: MessageListType;
    messageId: number;
    noHighlight?: boolean;
    groupedId?: string;
    groupedChatId?: string;
    replyMessageId?: number;
    isResizingContainer?: boolean;
    shouldReplaceHistory?: boolean;
    noForumTopicPanel?: boolean;
  } & WithTabId;

  focusLastMessage: WithTabId | undefined;
  setReplyingToId: {
    messageId?: number;
  } & WithTabId;
  closeWebApp: WithTabId | undefined;

  // Multitab
  destroyConnection: undefined;
  initShared: { force?: boolean } | undefined;
  switchMultitabRole: {
    isMasterTab: boolean;
  } & WithTabId;
  openChatInNewTab: {
    chatId: string;
    threadId?: number;
  };
  onTabFocusChange: {
    isBlurred: boolean;
  };
  onSomeTabSwitchedMultitabRole: undefined;
  afterHangUp: undefined;
  requestMasterAndCallAction: CallbackAction & WithTabId;
  clearMultitabNextAction: WithTabId | undefined;
  requestMasterAndJoinGroupCall: ActionPayloads['joinGroupCall'];
  requestMasterAndRequestCall: ActionPayloads['requestCall'];
  requestMasterAndAcceptCall: WithTabId | undefined;

  // Initial
  signOut: { forceInitApi?: boolean } | undefined;

  // Misc
  setInstallPrompt: { canInstall: boolean } & WithTabId;
  openLimitReachedModal: { limit: ApiLimitTypeWithModal } & WithTabId;
  closeLimitReachedModal: WithTabId | undefined;
  checkAppVersion: undefined;
  setGlobalSearchClosing: ({
    isClosing?: boolean;
  } & WithTabId) | undefined;

  // Accounts
  reportPeer: {
    chatId?: string;
    reason: ApiReportReason;
    description: string;
  } & WithTabId;
  reportProfilePhoto: {
    chatId?: string;
    reason: ApiReportReason;
    description: string;
    photo?: ApiPhoto;
  } & WithTabId;
  changeSessionSettings: {
    hash: string;
    areCallsEnabled?: boolean;
    areSecretChatsEnabled?: boolean;
  };
  changeSessionTtl: {
    days: number;
  };

  // Chats
  loadChatSettings: {
    chatId: string;
  };
  updateChatMutedState: {
    chatId: string;
    isMuted: boolean;
  };

  updateChat: {
    chatId: string;
    title: string;
    about: string;
    photo?: File;
  } & WithTabId;
  toggleSignatures: {
    chatId: string;
    isEnabled: boolean;
  };
  loadGroupsForDiscussion: undefined;
  linkDiscussionGroup: {
    channelId: string;
    chatId: string;
  } & WithTabId;
  unlinkDiscussionGroup: {
    channelId: string;
  } & WithTabId;

  openChat: {
    id: string | undefined;
    threadId?: number;
    type?: MessageListType;
    shouldReplaceHistory?: boolean;
    noForumTopicPanel?: boolean;
  } & WithTabId;
  loadFullChat: {
    chatId: string;
    force?: boolean;
  } & WithTabId;
  updateChatPhoto: {
    chatId: string;
    photo: ApiPhoto;
  } & WithTabId;
  deleteChatPhoto: {
    chatId: string;
    photo: ApiPhoto;
  } & WithTabId;
  openChatWithDraft: {
    chatId?: string;
    threadId?: number;
    text: string;
    files?: File[];
  } & WithTabId;
  resetOpenChatWithDraft: WithTabId | undefined;
  toggleJoinToSend: {
    chatId: string;
    isEnabled: boolean;
  };
  toggleJoinRequest: {
    chatId: string;
    isEnabled: boolean;
  };

  openForumPanel: {
    chatId: string;
  } & WithTabId;
  closeForumPanel: WithTabId | undefined;

  toggleParticipantsHidden: {
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
  } & WithTabId;
  focusNextReaction: WithTabId | undefined;
  focusNextMention: WithTabId | undefined;
  readAllReactions: WithTabId | undefined;
  readAllMentions: WithTabId | undefined;
  markMentionsRead: {
    messageIds: number[];
  } & WithTabId;

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

  // Reactions
  loadAvailableReactions: undefined;

  loadMessageReactions: {
    chatId: string;
    ids: number[];
  };

  toggleReaction: {
    chatId: string;
    messageId: number;
    reaction: ApiReaction;
  } & WithTabId;

  setDefaultReaction: {
    reaction: ApiReaction;
  };
  sendDefaultReaction: {
    chatId: string;
    messageId: number;
  } & WithTabId;

  setChatEnabledReactions: {
    chatId: string;
    enabledReactions?: ApiChatReactions;
  } & WithTabId;

  stopActiveReaction: {
    messageId: number;
    reaction: ApiReaction;
  } & WithTabId;

  // Media Viewer & Audio Player
  openMediaViewer: {
    chatId?: string;
    threadId?: number;
    mediaId?: number;
    avatarOwnerId?: string;
    profilePhotoIndex?: number;
    origin: MediaViewerOrigin;
    volume?: number;
    playbackRate?: number;
    isMuted?: boolean;
  } & WithTabId;
  closeMediaViewer: WithTabId | undefined;
  setMediaViewerVolume: {
    volume: number;
  } & WithTabId;
  setMediaViewerPlaybackRate: {
    playbackRate: number;
  } & WithTabId;
  setMediaViewerMuted: {
    isMuted: boolean;
  } & WithTabId;
  setMediaViewerHidden: {
    isHidden: boolean;
  } & WithTabId;
  openAudioPlayer: {
    chatId: string;
    threadId?: number;
    messageId: number;
    origin?: AudioOrigin;
    volume?: number;
    playbackRate?: number;
    isMuted?: boolean;
  } & WithTabId;
  closeAudioPlayer: WithTabId | undefined;
  setAudioPlayerVolume: {
    volume: number;
  } & WithTabId;
  setAudioPlayerPlaybackRate: {
    playbackRate: number;
    isPlaybackRateActive?: boolean;
  } & WithTabId;
  setAudioPlayerMuted: {
    isMuted: boolean;
  } & WithTabId;
  setAudioPlayerOrigin: {
    origin: AudioOrigin;
  } & WithTabId;

  // Downloads
  downloadSelectedMessages: WithTabId | undefined;
  downloadMessageMedia: {
    message: ApiMessage;
  } & WithTabId;
  cancelMessageMediaDownload: {
    message: ApiMessage;
  } & WithTabId;
  cancelMessagesMediaDownload: {
    messages: ApiMessage[];
  } & WithTabId;

  // Users
  loadNearestCountry: undefined;
  loadTopUsers: undefined;
  loadContactList: undefined;

  loadCurrentUser: undefined;
  updateProfile: {
    photo?: File;
    firstName?: string;
    lastName?: string;
    bio?: string;
    username?: string;
  } & WithTabId;
  checkUsername: {
    username: string;
  } & WithTabId;

  deleteContact: { userId: string };
  loadUser: { userId: string };
  setUserSearchQuery: { query?: string } & WithTabId;
  loadCommonChats: WithTabId | undefined;
  reportSpam: { chatId: string };
  loadFullUser: { userId: string };
  openAddContactDialog: { userId?: string } & WithTabId;
  openNewContactDialog: WithTabId | undefined;
  closeNewContactDialog: WithTabId | undefined;
  importContact: {
    phoneNumber: string;
    firstName: string;
    lastName?: string;
  } & WithTabId;
  updateContact: {
    userId: string;
    firstName: string;
    lastName?: string;
    isMuted?: boolean;
    shouldSharePhoneNumber?: boolean;
  } & WithTabId;
  loadProfilePhotos: {
    profileId: string;
  };
  deleteProfilePhoto: {
    photo: ApiPhoto;
  };
  updateProfilePhoto: {
    photo: ApiPhoto;
    isFallback?: boolean;
  };

  // Forwards
  openForwardMenu: {
    fromChatId: string;
    messageIds?: number[];
    groupedId?: string;
    withMyScore?: boolean;
  } & WithTabId;
  openForwardMenuForSelectedMessages: WithTabId | undefined;
  setForwardChatOrTopic: {
    chatId: string;
    topicId?: number;
  } & WithTabId;
  forwardMessages: {
    isSilent?: boolean;
    scheduledAt?: number;
  } & WithTabId;
  setForwardNoAuthors: {
    noAuthors: boolean;
  } & WithTabId;
  setForwardNoCaptions: {
    noCaptions: boolean;
  } & WithTabId;
  exitForwardMode: WithTabId | undefined;
  changeForwardRecipient: WithTabId | undefined;
  forwardToSavedMessages: WithTabId | undefined;

  // GIFs
  loadSavedGifs: undefined;

  // Stickers
  loadStickers: {
    stickerSetInfo: ApiStickerSetInfo;
  } & WithTabId;
  loadAnimatedEmojis: undefined;
  loadGreetingStickers: undefined;
  loadGenericEmojiEffects: undefined;

  addRecentSticker: {
    sticker: ApiSticker;
  };

  removeRecentSticker: {
    sticker: ApiSticker;
  };

  clearRecentStickers: undefined;

  loadStickerSets: undefined;
  loadAddedStickers: WithTabId | undefined;
  loadRecentStickers: undefined;
  loadFavoriteStickers: undefined;
  loadFeaturedStickers: undefined;

  reorderStickerSets: {
    isCustomEmoji?: boolean;
    order: string[];
  };

  addNewStickerSet: {
    stickerSet: ApiStickerSet;
  };

  openStickerSet: { stickerSetInfo: ApiStickerSetInfo } & WithTabId;
  closeStickerSetModal: WithTabId | undefined;

  loadStickersForEmoji: {
    emoji: string;
  };
  clearStickersForEmoji: undefined;

  loadCustomEmojiForEmoji: {
    emoji: string;
  };
  clearCustomEmojiForEmoji: undefined;

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
  } & WithTabId;
  closeCustomEmojiSets: WithTabId | undefined;
  addRecentCustomEmoji: {
    documentId: string;
  };
  clearRecentCustomEmoji: undefined;
  loadFeaturedEmojiStickers: undefined;
  loadDefaultStatusIcons: undefined;
  loadRecentEmojiStatuses: undefined;

  // Bots
  sendBotCommand: {
    command: string;
    chatId?: string;
  } & WithTabId;
  loadTopInlineBots: undefined;
  queryInlineBot: {
    chatId: string;
    username: string;
    query: string;
    offset?: string;
  } & WithTabId;
  sendInlineBotResult: {
    id: string;
    queryId: string;
    isSilent?: boolean;
    scheduledAt?: number;
  } & WithTabId;
  resetInlineBot: {
    username: string;
    force?: boolean;
  } & WithTabId;
  resetAllInlineBots: WithTabId | undefined;
  startBot: {
    botId: string;
    param?: string;
  };
  restartBot: {
    chatId: string;
  } & WithTabId;

  clickBotInlineButton: {
    messageId: number;
    button: ApiKeyboardButton;
  } & WithTabId;

  switchBotInline: {
    messageId: number;
    query: string;
    isSamePeer?: boolean;
  } & WithTabId;

  openGame: {
    url: string;
    chatId: string;
    messageId: number;
  } & WithTabId;
  closeGame: WithTabId | undefined;

  requestWebView: {
    url?: string;
    botId: string;
    peerId: string;
    theme?: ApiThemeParameters;
    isSilent?: boolean;
    buttonText: string;
    isFromBotMenu?: boolean;
    startParam?: string;
  } & WithTabId;
  prolongWebView: {
    botId: string;
    peerId: string;
    queryId: string;
    isSilent?: boolean;
    replyToMessageId?: number;
    threadId?: number;
  } & WithTabId;
  requestSimpleWebView: {
    url: string;
    botId: string;
    buttonText: string;
    theme?: ApiThemeParameters;
  } & WithTabId;
  setWebAppPaymentSlug: {
    slug?: string;
  } & WithTabId;

  cancelBotTrustRequest: WithTabId | undefined;
  markBotTrusted: {
    botId: string;
  } & WithTabId;

  cancelAttachBotInstall: WithTabId | undefined;
  confirmAttachBotInstall: {
    isWriteAllowed: boolean;
  } & WithTabId;

  processAttachBotParameters: {
    username: string;
    filter: ApiChatType[];
    startParam?: string;
  } & WithTabId;
  requestAttachBotInChat: {
    bot: ApiAttachBot;
    filter: ApiChatType[];
    startParam?: string;
  } & WithTabId;
  cancelAttachBotInChat: WithTabId | undefined;

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
    isWriteAllowed?: boolean;
    isEnabled: boolean;
  };

  callAttachBot: {
    chatId: string;
    threadId?: number;
    bot?: ApiAttachBot;
    url?: string;
    startParam?: string;
  } & WithTabId;

  requestBotUrlAuth: {
    chatId: string;
    messageId: number;
    buttonId: number;
    url: string;
  } & WithTabId;

  acceptBotUrlAuth: {
    isWriteAllowed?: boolean;
  } & WithTabId;

  requestLinkUrlAuth: {
    url: string;
  } & WithTabId;

  acceptLinkUrlAuth: {
    isWriteAllowed?: boolean;
  } & WithTabId;

  // Settings
  loadAuthorizations: undefined;
  terminateAuthorization: {
    hash: string;
  };
  terminateAllAuthorizations: undefined;

  loadWebAuthorizations: undefined;
  terminateWebAuthorization: {
    hash: string;
  };
  terminateAllWebAuthorizations: undefined;
  toggleUsername: {
    username: string;
    isActive: boolean;
  };
  sortUsernames: {
    usernames: string[];
  };
  toggleChatUsername: {
    chatId: string;
    username: string;
    isActive: boolean;
  } & WithTabId;
  sortChatUsernames: {
    chatId: string;
    usernames: string[];
  };

  // Misc
  openPollModal: {
    isQuiz?: boolean;
  } & WithTabId;
  closePollModal: WithTabId | undefined;
  requestConfetti: ({
    top: number;
    left: number;
    width: number;
    height: number;
  } & WithTabId) | undefined;

  updateAttachmentSettings: {
    shouldCompress?: boolean;
    shouldSendGrouped?: boolean;
  };

  openUrl: {
    url: string;
    shouldSkipModal?: boolean;
  } & WithTabId;
  toggleSafeLinkModal: {
    url?: string;
  } & WithTabId;
  closeUrlAuthModal: WithTabId | undefined;
  showNotification: {
    localId?: string;
    title?: string;
    message: string;
    className?: string;
    actionText?: string;
    action?: CallbackAction;
  } & WithTabId;
  dismissNotification: { localId: string } & WithTabId;

  updatePageTitle: {
    isInactive?: boolean;
    notificationCount?: number;
  } & WithTabId | undefined;

  // Calls
  joinGroupCall: {
    chatId?: string;
    id?: string;
    accessHash?: string;
    inviteHash?: string;
  } & WithTabId;
  toggleGroupCallMute: {
    participantId: string;
    value: boolean;
  };
  toggleGroupCallPresentation: {
    value?: boolean;
  } | undefined;
  leaveGroupCall: ({
    isFromLibrary?: boolean;
    shouldDiscard?: boolean;
    shouldRemove?: boolean;
    rejoin?: ActionPayloads['joinGroupCall'];
  } & WithTabId) | undefined;

  toggleGroupCallVideo: undefined;
  requestToSpeak: {
    value: boolean;
  } | undefined;
  setGroupCallParticipantVolume: {
    participantId: string;
    volume: number;
  };
  toggleGroupCallPanel: ({ force?: boolean } & WithTabId) | undefined;

  createGroupCall: {
    chatId: string;
  } & WithTabId;
  joinVoiceChatByLink: {
    username: string;
    inviteHash: string;
  } & WithTabId;
  subscribeToGroupCallUpdates: {
    subscribed: boolean;
    id: string;
  };
  createGroupCallInviteLink: WithTabId | undefined;

  loadMoreGroupCallParticipants: undefined;
  connectToActiveGroupCall: WithTabId | undefined;

  requestCall: {
    userId: string;
    isVideo?: boolean;
  } & WithTabId;
  sendSignalingData: P2pMessage;
  hangUp: WithTabId | undefined;
  acceptCall: undefined;
  setCallRating: {
    rating: number;
    comment: string;
  } & WithTabId;
  closeCallRatingModal: WithTabId | undefined;
  playGroupCallSound: {
    sound: CallSound;
  };
  connectToActivePhoneCall: undefined;

  // Passcode
  setPasscode: { passcode: string };
  clearPasscode: undefined;
  lockScreen: undefined;
  decryptSession: { passcode: string };
  unlockScreen: { sessionJson: string; globalJson: string };
  softSignIn: undefined;
  logInvalidUnlockAttempt: undefined;
  resetInvalidUnlockAttempts: undefined;
  setPasscodeError: { error: string };
  clearPasscodeError: undefined;
  skipLockOnUnload: undefined;

  // Settings
  loadConfig: undefined;
  loadAppConfig: undefined;
  requestNextSettingsScreen: {
    screen?: SettingsScreens;
  } & WithTabId;
  sortChatFolders: { folderIds: number[] };
  closeDeleteChatFolderModal: WithTabId | undefined;
  openDeleteChatFolderModal: { folderId: number } & WithTabId;
  loadGlobalPrivacySettings: undefined;
  updateGlobalPrivacySettings: { shouldArchiveAndMuteNewNonContact: boolean };

  // Premium
  openPremiumModal: {
    initialSection?: string;
    fromUserId?: string;
    toUserId?: string;
    isSuccess?: boolean;
    isGift?: boolean;
    monthsAmount?: number;
  } & WithTabId;
  closePremiumModal: ({
    isClosed?: boolean;
  } & WithTabId) | undefined;

  transcribeAudio: {
    chatId: string;
    messageId: number;
  };

  loadPremiumGifts: undefined;
  loadDefaultTopicIcons: never;
  loadPremiumStickers: undefined;
  loadPremiumSetStickers: {
    hash?: string;
  };

  openGiftPremiumModal: ({
    forUserId?: string;
  } & WithTabId) | undefined;

  closeGiftPremiumModal: WithTabId | undefined;
  setEmojiStatus: {
    emojiStatus: ApiSticker;
    expires?: number;
  };

  // Invoice
  openInvoice: ApiInputInvoice & WithTabId;

  // Payment
  validatePaymentPassword: {
    password: string;
  } & WithTabId;

  // Forums
  toggleForum: {
    chatId: string;
    isEnabled: boolean;
  };
  createTopic: {
    chatId: string;
    title: string;
    iconColor?: number;
    iconEmojiId?: string;
  } & WithTabId;
  loadTopics: {
    chatId: string;
    force?: boolean;
  };
  loadTopicById: ({
    chatId: string;
    topicId: number;
  } | {
    chatId: string;
    topicId: number;
    shouldCloseChatOnError?: boolean;
  } & WithTabId);

  deleteTopic: {
    chatId: string;
    topicId: number;
  };

  editTopic: {
    chatId: string;
    topicId: number;
    title?: string;
    iconEmojiId?: string;
    isClosed?: boolean;
    isHidden?: boolean;
  } & WithTabId;

  toggleTopicPinned: {
    chatId: string;
    topicId: number;
    isPinned: boolean;
  } & WithTabId;

  markTopicRead: {
    chatId: string;
    topicId: number;
  };

  updateTopicMutedState: {
    chatId: string;
    topicId: number;
    isMuted: boolean;
  };

  openCreateTopicPanel: {
    chatId: string;
  } & WithTabId;
  closeCreateTopicPanel: WithTabId | undefined;

  openEditTopicPanel: {
    chatId: string;
    topicId: number;
  } & WithTabId;
  closeEditTopicPanel: WithTabId | undefined;

  uploadContactProfilePhoto: {
    userId: string;
    file?: File;
    isSuggest?: boolean;
  } & WithTabId;
}

export type RequiredGlobalState = GlobalState & { _: never };
const typed = typify<GlobalState, ActionPayloads & RequiredActionPayloads>();
export type GlobalActions = ReturnType<typeof typed.getActions>;
export type ActionReturnType = GlobalState | void | Promise<void>;
export type TabArgs<T> = T extends RequiredGlobalState ? [
  tabId: number,
] : [
  tabId?: number | undefined,
];
