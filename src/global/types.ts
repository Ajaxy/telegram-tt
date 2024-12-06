import type {
  ApiAppConfig,
  ApiAttachBot,
  ApiAttachment,
  ApiAvailableEffect,
  ApiAvailableReaction,
  ApiBoost,
  ApiBoostsStatus,
  ApiBotPreviewMedia,
  ApiChannelMonetizationStatistics,
  ApiChannelStatistics,
  ApiChat,
  ApiChatAdminRights,
  ApiChatBannedRights,
  ApiChatFolder,
  ApiChatFullInfo,
  ApiChatInviteInfo,
  ApiChatlistExportedInvite,
  ApiChatlistInvite,
  ApiChatReactions,
  ApiChatType,
  ApiCheckedGiftCode,
  ApiCollectionInfo,
  ApiConfig,
  ApiContact,
  ApiCountry,
  ApiCountryCode,
  ApiError,
  ApiExportedInvite,
  ApiFormattedText,
  ApiGeoPoint,
  ApiGlobalMessageSearchType,
  ApiGroupCall,
  ApiGroupStatistics,
  ApiInputInvoice,
  ApiInputInvoiceStarGift,
  ApiInputMessageReplyInfo,
  ApiKeyboardButton,
  ApiLanguage,
  ApiMediaFormat,
  ApiMessage,
  ApiMessageEntity,
  ApiMissingInvitedUser,
  ApiMyBoost,
  ApiNewPoll,
  ApiNotification,
  ApiPaymentFormRegular,
  ApiPaymentFormStars,
  ApiPeerColors,
  ApiPeerPhotos,
  ApiPeerStories,
  ApiPhoneCall,
  ApiPhoto,
  ApiPoll,
  ApiPostStatistics,
  ApiPremiumGiftCodeOption,
  ApiPremiumPromo,
  ApiQuickReply,
  ApiReaction,
  ApiReactionKey,
  ApiReactionWithPaid,
  ApiReceiptRegular,
  ApiReportReason,
  ApiSavedReactionTag,
  ApiSendMessageAction,
  ApiSession,
  ApiSessionData,
  ApiSponsoredMessage,
  ApiStarGift,
  ApiStarGiveawayOption,
  ApiStarsSubscription,
  ApiStarsTransaction,
  ApiStarTopupOption,
  ApiStealthMode,
  ApiSticker,
  ApiStickerSet,
  ApiStickerSetInfo,
  ApiThemeParameters,
  ApiThreadInfo,
  ApiTimezone,
  ApiTopic,
  ApiTranscription,
  ApiTypePrepaidGiveaway,
  ApiTypeStoryView,
  ApiTypingStatus,
  ApiUpdate,
  ApiUpdateAuthorizationStateType,
  ApiUpdateConnectionStateType,
  ApiUser,
  ApiUserCommonChats,
  ApiUserFullInfo,
  ApiUserGifts,
  ApiUserStarGift,
  ApiUserStatus,
  ApiVideo,
  ApiWallpaper,
  ApiWebPage,
  ApiWebSession,
} from '../api/types';
import type { ApiCredentials } from '../components/payment/PaymentModal';
import type { PREMIUM_FEATURE_SECTIONS } from '../config';
import type { FoldersActions } from '../hooks/reducers/useFoldersReducer';
import type { ReducerAction } from '../hooks/useReducer';
import type { P2pMessage } from '../lib/secret-sauce';
import type {
  ApiPrivacyKey,
  ApiPrivacySettings,
  AudioOrigin,
  ChatCreationProgress,
  ChatMediaSearchParams,
  EmojiKeywords,
  FocusDirection,
  GlobalSearchContent,
  IAlbum,
  IAnchorPosition,
  InlineBotSettings,
  ISettings,
  IThemeSettings,
  LoadMoreDirection,
  ManagementProgress,
  ManagementScreens,
  ManagementState,
  MediaViewerMedia,
  MediaViewerOrigin,
  MiddleSearchParams,
  NewChatMembersProgress,
  NotifyException,
  PaymentStep,
  PerformanceType,
  PrivacyVisibility,
  ProfileEditProgress,
  ProfileTabType,
  ScrollTargetPosition,
  SettingsScreens,
  SharedMediaType,
  ShippingOption,
  StoryViewerOrigin,
  ThemeKey,
  ThreadId,
} from '../types';
import type { WebAppOutboundEvent } from '../types/webapp';
import type { SearchResultKey } from '../util/keys/searchResultKey';
import type { DownloadableMedia } from './helpers';

export type MessageListType =
  'thread'
  | 'pinned'
  | 'scheduled';

export type ChatListType = 'active' | 'archived' | 'saved';

export type WebAppModalStateType = 'fullScreen' | 'maximized' | 'minimized';

export interface MessageList {
  chatId: string;
  threadId: ThreadId;
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

export type ActiveDownloads = Record<string, {
  format: ApiMediaFormat;
  filename: string;
  size: number;
  originChatId?: string;
  originMessageId?: number;
}>;

export type IDimensions = {
  width: number;
  height: number;
};

export type ApiPaymentStatus = 'paid' | 'failed' | 'pending' | 'cancelled';

export type StarsTransactionType = 'all' | 'inbound' | 'outbound';
export type StarsTransactionHistory = Record<StarsTransactionType, {
  transactions: ApiStarsTransaction[];
  nextOffset?: string;
} | undefined>;
export type StarsSubscriptions = {
  list: ApiStarsSubscription[];
  nextOffset?: string;
};

export type ConfettiStyle = 'poppers' | 'top-down';

export type StarGiftInfo = {
  userId: string;
  gift: ApiStarGift;
  shouldHideName?: boolean;
  message?: ApiFormattedText;
};

export interface TabThread {
  scrollOffset?: number;
  replyStack?: number[];
  viewportIds?: number[];
}

export interface Thread {
  lastScrollOffset?: number;
  lastViewportIds?: number[];
  listedIds?: number[];
  outlyingLists?: number[][];
  pinnedIds?: number[];
  scheduledIds?: number[];
  editingId?: number;
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

export interface TopicsInfo {
  totalCount: number;
  topicsById: Record<ThreadId, ApiTopic>;
  listedTopicIds?: number[];
  orderedPinnedTopicIds?: number[];
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

export type ApiPremiumSection = typeof PREMIUM_FEATURE_SECTIONS[number];

export type TranslatedMessage = {
  isPending?: boolean;
  text?: ApiFormattedText;
};

export type ChatTranslatedMessages = {
  byLangCode: Record<string, Record<number, TranslatedMessage>>;
};

export type ChatRequestedTranslations = {
  toLanguage?: string;
  manualMessages?: Record<number, string>;
};

type ConfettiParams = OptionalCombine<{
  style?: ConfettiStyle;
  withStars?: boolean;
}, {
  top?: number;
  left?: number;
  width?: number;
  height?: number;
}>;

export type WebPageMediaSize = 'large' | 'small';

export type TabState = {
  id: number;
  isBlurred?: boolean;
  isMasterTab: boolean;
  isInactive?: boolean;
  shouldPreventComposerAnimation?: boolean;
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

  shouldCloseRightColumn?: boolean;
  nextProfileTab?: ProfileTabType;
  forceScrollProfileTab?: boolean;
  nextSettingsScreen?: SettingsScreens;
  nextFoldersAction?: ReducerAction<FoldersActions>;
  shareFolderScreen?: {
    folderId: number;
    isFromSettings?: boolean;
    url?: string;
    isLoading?: boolean;
  };

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
    isInvertedMedia?: true;
  };

  activeChatFolder: number;
  tabThreads: Record<string, Record<ThreadId, TabThread>>;
  forumPanelChatId?: string;

  focusedMessage?: {
    chatId?: string;
    threadId?: ThreadId;
    messageId?: number;
    direction?: FocusDirection;
    noHighlight?: boolean;
    isResizingContainer?: boolean;
    quote?: string;
    scrollTargetPosition?: ScrollTargetPosition;
  };

  selectedMessages?: {
    chatId: string;
    messageIds: number[];
  };

  chatInviteModal?: {
    hash: string;
    inviteInfo: ApiChatInviteInfo;
  };

  seenByModal?: {
    chatId: string;
    messageId: number;
  };

  privacySettingsNoticeModal?: {
    chatId: string;
    isReadDate: boolean;
  };

  reactorModal?: {
    chatId: string;
    messageId: number;
  };

  aboutAdsModal?: {
    chatId: string;
  };

  reactionPicker?: {
    chatId?: string;
    messageId?: number;
    storyPeerId?: string;
    storyId?: number;
    position?: IAnchorPosition;
    sendAsMessage?: boolean;
    isForEffects?: boolean;
  };

  shouldPlayEffectInComposer?: true;

  inlineBots: {
    isLoading: boolean;
    byUsername: Record<string, false | InlineBotSettings>;
  };

  globalSearch: {
    query?: string;
    minDate?: number;
    maxDate?: number;
    currentContent?: GlobalSearchContent;
    chatId?: string;
    foundTopicIds?: number[];
    fetchingStatus?: {
      chats?: boolean;
      messages?: boolean;
      botApps?: boolean;
    };
    isClosing?: boolean;
    localResults?: {
      peerIds?: string[];
    };
    globalResults?: {
      peerIds?: string[];
    };
    popularBotApps?: {
      peerIds: string[];
      nextOffset?: string;
    };
    resultsByType?: Partial<Record<ApiGlobalMessageSearchType, {
      totalCount?: number;
      nextOffsetId?: number;
      nextOffsetPeerId?: string;
      nextOffsetRate?: number;
      foundIds: SearchResultKey[];
    }>>;
  };

  userSearch: {
    query?: string;
    fetchingStatus?: boolean;
    localUserIds?: string[];
    globalUserIds?: string[];
  };

  activeEmojiInteractions?: ActiveEmojiInteraction[];
  activeReactions: Record<string, ApiReactionWithPaid[]>;

  middleSearch: {
    byChatThreadKey: Record<string, MiddleSearchParams | undefined>;
  };

  sharedMediaSearch: {
    byChatThreadKey: Record<string, {
      currentType?: SharedMediaType;
      resultsByType?: Partial<Record<SharedMediaType, {
        totalCount?: number;
        nextOffsetId: number;
        foundIds: number[];
      }>>;
    }>;
  };

  chatMediaSearch: {
    byChatThreadKey: Record<string, ChatMediaSearchParams>;
  };

  management: {
    progress?: ManagementProgress;
    byChatId: Record<string, ManagementState>;
  };

  storyViewer: {
    isRibbonShown?: boolean;
    isArchivedRibbonShown?: boolean;
    peerId?: string;
    storyId?: number;
    isMuted: boolean;
    isSinglePeer?: boolean;
    isSingleStory?: boolean;
    isPrivate?: boolean;
    isArchive?: boolean;
    // Last viewed story id in current view session.
    // Used for better switch animation between peers.
    lastViewedByPeerIds?: Record<string, number>;
    isPrivacyModalOpen?: boolean;
    isStealthModalOpen?: boolean;
    viewModal?: {
      storyId: number;
      views?: ApiTypeStoryView[];
      nextOffset?: string;
      isLoading?: boolean;
    };
    origin?: StoryViewerOrigin;
    // Copy of story list for current view session
    storyList?: {
      peerIds: string[];
      storyIdsByPeerId: Record<string, number[]>;
    };
  };

  mediaViewer: {
    chatId?: string;
    threadId?: ThreadId;
    messageId?: number;
    withDynamicLoading?: boolean;
    mediaIndex?: number;
    isAvatarView?: boolean;
    isSponsoredMessage?: boolean;
    standaloneMedia?: MediaViewerMedia[];
    origin?: MediaViewerOrigin;
    volume: number;
    playbackRate: number;
    isMuted: boolean;
    isHidden?: boolean;
  };

  audioPlayer: {
    chatId?: string;
    messageId?: number;
    threadId?: ThreadId;
    origin?: AudioOrigin;
    volume: number;
    playbackRate: number;
    isPlaybackRateActive?: boolean;
    isMuted: boolean;
  };

  webPagePreview?: ApiWebPage;

  loadingThread?: {
    loadingChatId: string;
    loadingMessageId: number;
  };

  isShareMessageModalShown?: boolean;

  replyingMessage: {
    fromChatId?: string;
    messageId?: number;
    quoteText?: ApiFormattedText;
    toChatId?: string;
    toThreadId?: ThreadId;
  };

  forwardMessages: {
    fromChatId?: string;
    messageIds?: number[];
    storyId?: number;
    toChatId?: string;
    toThreadId?: ThreadId;
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

  isPaymentFormLoading?: boolean;
  payment: {
    inputInvoice?: ApiInputInvoice;
    step?: PaymentStep;
    status?: ApiPaymentStatus;
    shippingOptions?: ShippingOption[];
    requestId?: string;
    form?: ApiPaymentFormRegular;
    stripeCredentials?: {
      type: string;
      id: string;
    };
    smartGlocalCredentials?: {
      type: string;
      token: string;
    };
    receipt?: ApiReceiptRegular;
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
    url?: string;
    botId?: string;
  };
  starsPayment: {
    form?: ApiPaymentFormStars;
    subscriptionInfo?: ApiChatInviteInfo;
    inputInvoice?: ApiInputInvoice;
    status?: ApiPaymentStatus;
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
  dialogs: (ApiError | ApiContact)[];

  safeLinkModalUrl?: string;
  mapModal?: {
    point: ApiGeoPoint;
    zoom?: number;
  };
  historyCalendarSelectedAt?: number;
  openedStickerSetShortName?: string;
  openedCustomEmojiSetIds?: string[];

  reportAdModal?: {
    chatId: string;
    randomId: string;
    sections: {
      title: string;
      subtitle?: string;
      options: {
        text: string;
        option: string;
      }[];
    }[];
  };

  reportModal?: {
    chatId?: string;
    messageIds: number[];
    description: string;
    peerId?: string;
    subject: 'story' | 'message';
    sections: {
      title?: string;
      subtitle?: string;
      options?: {
        text: string;
        option: string;
      }[];
      isOptional?: boolean;
      option?: string;
    }[];
  };

  activeDownloads: ActiveDownloads;

  statistics: {
    byChatId: Record<string, ApiChannelStatistics | ApiGroupStatistics>;
    currentMessage?: ApiPostStatistics;
    currentMessageId?: number;
    currentStory?: ApiPostStatistics;
    currentStoryId?: number;
    monetization?: ApiChannelMonetizationStatistics;
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
    text: ApiFormattedText;
    files?: File[];
    filter?: ApiChatType[];
  };

  pollModal: {
    isOpen: boolean;
    isQuiz?: boolean;
  };

  webApps: {
    activeWebAppKey?: string;
    openedOrderedKeys: string[];
    sessionKeys: string[];
    openedWebApps: Record<string, WebApp>;
    modalState : WebAppModalStateType;
    isModalOpen: boolean;
    isMoreAppsTabActive: boolean;
  };

  botTrustRequest?: {
    botId: string;
    type: 'game' | 'webApp' | 'botApp';
    shouldRequestWriteAccess?: boolean;
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
    style?: ConfettiStyle;
    withStars?: boolean;
  };
  wave?: {
    lastWaveTime: number;
    startX: number;
    startY: number;
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
    promo: ApiPremiumPromo;
    initialSection?: ApiPremiumSection;
    fromUserId?: string;
    toUserId?: string;
    isGift?: boolean;
    monthsAmount?: number;
    isSuccess?: boolean;
  };

  giveawayModal?: {
    chatId: string;
    isOpen?: boolean;
    gifts?: ApiPremiumGiftCodeOption[];
    selectedMemberIds?: string[];
    selectedChannelIds?: string[];
    prepaidGiveaway?: ApiTypePrepaidGiveaway;
    starOptions?: ApiStarGiveawayOption[];
  };

  deleteMessageModal?: {
    message?: ApiMessage;
    isSchedule?: boolean;
    album?: IAlbum;
    onConfirm?: NoneToVoidFunction;
  };

  isWebAppsCloseConfirmationModalOpen?: boolean;

  isGiftRecipientPickerOpen?: boolean;

  starsGiftingPickerModal?: {
    isOpen?: boolean;
  };

  starsGiftModal?: {
    isCompleted?: boolean;
    isOpen?: boolean;
    forUserId?: string;
    starsGiftOptions?: ApiStarTopupOption[];
  };

  starsTransactionModal?: {
    transaction: ApiStarsTransaction;
  };
  starsSubscriptionModal?: {
    subscription: ApiStarsSubscription;
  };

  giftModal?: {
    isCompleted?: boolean;
    forUserId: string;
    gifts: ApiPremiumGiftCodeOption[];
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

  requestedTranslations: {
    byChatId: Record<string, ChatRequestedTranslations>;
  };
  chatLanguageModal?: {
    chatId: string;
    messageId?: number;
    activeLanguage?: string;
  };

  chatlistModal?: {
    invite?: ApiChatlistInvite;
    removal?: {
      folderId: number;
      suggestedPeerIds?: string[];
    };
  };

  boostModal?: {
    chatId: string;
    boostStatus?: ApiBoostsStatus;
    myBoosts?: ApiMyBoost[];
  };

  boostStatistics?: {
    chatId: string;
    boostStatus?: ApiBoostsStatus;
    isLoadingBoosters?: boolean;
    nextOffset?: string;
    boosts?: {
      count: number;
      list: ApiBoost[];
    };
    giftedBoosts?: {
      count: number;
      list: ApiBoost[];
    };
  };

  monetizationStatistics?: {
    chatId: string;
  };

  giftCodeModal?: {
    slug: string;
    message?: {
      chatId: string;
      messageId: number;
    };
    info: ApiCheckedGiftCode;
  };

  paidReactionModal?: {
    chatId: string;
    messageId: number;
  };

  inviteViaLinkModal?: {
    missingUsers: ApiMissingInvitedUser[];
    chatId: string;
  };

  oneTimeMediaModal?: {
    message: ApiMessage;
  };

  collectibleInfoModal?: ApiCollectionInfo & {
    peerId: string;
    type: 'phone' | 'username';
    collectible: string;
  };

  starsBalanceModal?: {
    originStarsPayment?: TabState['starsPayment'];
    originGift?: StarGiftInfo;
    originReaction?: {
      chatId: string;
      messageId: number;
      amount: number;
    };
    topup?: {
      balanceNeeded: number;
      purpose?: string;
    };
  };

  giftInfoModal?: {
    userId?: string;
    gift: ApiUserStarGift | ApiStarGift;
  };

  suggestedStatusModal?: {
    botId: string;
    webAppKey?: string;
    customEmojiId: string;
    duration?: number;
  };
};

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
    error?: string;
    waitingEmailCodeLength?: number;
  };

  monetizationInfo: {
    isLoading?: boolean;
    error?: string;
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
    // Obtained from GetFullUser / UserFullInfo
    fullInfoById: Record<string, ApiUserFullInfo>;
    previewMediaByBotId: Record<string, ApiBotPreviewMedia[]>;
    commonChatsById: Record<string, ApiUserCommonChats>;
    giftsById: Record<string, ApiUserGifts>;
  };
  profilePhotosById: Record<string, ApiPeerPhotos>;

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
    similarChannelsById: Record<
    string,
    {
      shouldShowInChat: boolean;
      similarChannelIds: string[];
      count: number;
    }
    >;
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
  starGiftsById: Record<string, ApiStarGift>;
  starGiftCategoriesByName: Record<StarGiftCategory, string[]>;

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
    starGifts: {
      stickers: Record<string, ApiSticker>;
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
    balance: number;
    history: StarsTransactionHistory;
    subscriptions?: StarsSubscriptions;
  };
};

export type StarGiftCategory = number | 'all' | 'limited';

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

export type ApiDraft = {
  text?: ApiFormattedText;
  replyInfo?: ApiInputMessageReplyInfo;
  date?: number;
  effectId?: string;
  isLocal?: boolean;
};

export type WebApp = {
  url: string;
  requestUrl?: string;
  botId: string;
  appName?: string;
  buttonText: string;
  peerId?: string;
  queryId?: string;
  slug?: string;
  replyInfo?: ApiInputMessageReplyInfo;
  canSendMessages?: boolean;
  isRemoveModalOpen?: boolean;
  isCloseModalOpen?: boolean;
  shouldConfirmClosing?: boolean;
  headerColor?: string;
  serverHeaderColor?: string;
  serverHeaderColorKey?: 'bg_color' | 'secondary_bg_color';
  backgroundColor?: string;
  isBackButtonVisible?: boolean;
  isSettingsButtonVisible?: boolean;
  plannedEvents?: WebAppOutboundEvent[];
  sendEvent?: (event: WebAppOutboundEvent) => void;
  reloadFrame?: (url: string) => void;
};

type WithTabId = { tabId?: number };

export interface ActionPayloads {
  // system
  init: ({
    isMasterTab?: boolean;
  } & WithTabId) | undefined;
  reset: undefined;
  disconnect: undefined;
  initApi: undefined;
  initMain: undefined;
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
    bot?: ApiUser;
    tabId?: number;
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
  loadEmojiKeywords: { language: string };

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

  checkChatInvite: {
    hash: string;
  } & WithTabId;
  acceptChatInvite: { hash: string } & WithTabId;
  closeChatInviteModal: WithTabId | undefined;

  // settings
  setSettingOption: Partial<ISettings> | undefined;
  updatePerformanceSettings: Partial<PerformanceType>;
  loadPasswordInfo: undefined;
  clearTwoFaError: undefined;
  clearMonetizationInfo: undefined;
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
  loadBlockedUsers: {
    isOnlyStories?: boolean;
  } | undefined;
  blockUser: {
    userId: string;
    isOnlyStories?: boolean;
  };
  unblockUser: {
    userId: string;
    isOnlyStories?: boolean;
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
    onSuccess?: VoidFunction;
  };

  setPrivacySettings: {
    privacyKey: ApiPrivacyKey;
    isAllowList: boolean;
    updatedIds: string[];
    isPremiumAllowed?: true;
  };
  loadNotificationExceptions: undefined;
  setThemeSettings: { theme: ThemeKey } & Partial<IThemeSettings>;
  updateIsOnline: boolean;

  loadContentSettings: undefined;
  updateContentSettings: boolean;

  loadCountryList: {
    langCode?: string;
  };
  ensureTimeFormat: WithTabId | undefined;

  // misc
  loadWebPagePreview: {
    text: ApiFormattedText;
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
  saveCloseFriends: {
    userIds: string[];
  };

  // Message search
  openMiddleSearch: WithTabId | undefined;
  closeMiddleSearch: WithTabId | undefined;
  updateMiddleSearch: {
    chatId: string;
    threadId?: ThreadId;
    update: Partial<Omit<MiddleSearchParams, 'results'>>;
  } & WithTabId;
  resetMiddleSearch: WithTabId | undefined;
  performMiddleSearch: {
    chatId: string;
    threadId?: ThreadId;
    query?: string;
  } & WithTabId;
  searchHashtag: {
    hashtag: string;
  } & WithTabId;
  setSharedMediaSearchType: {
    mediaType: SharedMediaType;
  } & WithTabId;
  searchSharedMediaMessages: WithTabId | undefined;
  searchChatMediaMessages: {
    currentMediaMessageId: number;
    direction?: LoadMoreDirection;
    chatId?: string;
    threadId? : ThreadId;
    limit?: number;
  } & WithTabId;
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
  };
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
    listType: ChatListType;
    whenFirstBatchDone?: () => Promise<void>;
  };
  openChatWithInfo: ActionPayloads['openChat'] & {
    profileTab?: ProfileTabType;
    forceScrollProfileTab?: boolean;
  } & WithTabId;
  openThreadWithInfo: ActionPayloads['openThread'] & WithTabId;
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
  openChatByPhoneNumber: {
    phoneNumber: string;
    startAttach?: string | boolean;
    attach?: string;
    text?: string;
  } & WithTabId;
  toggleSavedDialogPinned: {
    id: string;
  } & WithTabId;

  // global search
  setGlobalSearchQuery: {
    query?: string;
  } & WithTabId;
  searchMessagesGlobal: {
    type: ApiGlobalMessageSearchType;
  } & WithTabId;
  searchPopularBotApps: WithTabId | undefined;
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
    threadId?: ThreadId;
    shouldForceRender?: boolean;
    onLoaded?: NoneToVoidFunction;
    onError?: NoneToVoidFunction;
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
    shouldUpdateStickerSetOrder?: boolean;
    shouldGroupMessages?: boolean;
    messageList?: MessageList;
    isReaction?: true; // Reaction to the story are sent in the form of a message
    isInvertedMedia?: true;
    effectId?: string;
    webPageMediaSize?: WebPageMediaSize;
    webPageUrl?: string;
  } & WithTabId;
  sendInviteMessages: {
    chatId: string;
    userIds: string[];
  } & WithTabId;
  cancelUploadMedia: {
    chatId: string;
    messageId: number;
  };
  pinMessage: {
    chatId: string;
    messageId: number;
    isUnpin: boolean;
    isOneSide?: boolean;
    isSilent?: boolean;
  };
  deleteMessages: {
    messageIds: number[];
    shouldDeleteForAll?: boolean;
  } & WithTabId;
  markMessageListRead: {
    maxId: number;
  } & WithTabId;
  markMessagesRead: {
    messageIds: number[];
    shouldFetchUnreadReactions?: boolean;
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
    messageList?: MessageList;
    text: string;
    attachments?: ApiAttachment[];
    entities?: ApiMessageEntity[];
  } & WithTabId;
  deleteHistory: {
    chatId: string;
    shouldDeleteForAll?: boolean;
  } & WithTabId;
  deleteSavedHistory: {
    chatId: string;
  } & WithTabId;
  loadSponsoredMessages: {
    peerId: string;
  };
  viewSponsoredMessage: {
    peerId: string;
  };
  clickSponsoredMessage: {
    peerId: string;
    isMedia?: boolean;
    isFullscreen?: boolean;
  };
  reportSponsoredMessage: {
    peerId: string;
    randomId: string;
    option?: string;
  } & WithTabId;
  openAboutAdsModal: {
    chatId: string;
  } & WithTabId;
  closeAboutAdsModal: WithTabId | undefined;
  openPreviousReportAdModal: WithTabId | undefined;
  openPreviousReportModal: WithTabId | undefined;
  closeReportAdModal: WithTabId | undefined;
  closeReportModal: WithTabId | undefined;
  hideSponsoredMessages: WithTabId | undefined;
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
    chatId: string;
    messageIds: number[];
    description?: string;
    option?: string;
  } & WithTabId;
  sendMessageAction: {
    action: ApiSendMessageAction;
    chatId: string;
    threadId: ThreadId;
  };
  reportChannelSpam: {
    chatId: string;
    participantId: string;
    messageIds: number[];
  };
  loadSeenBy: {
    chatId: string;
    messageId: number;
  };
  openTelegramLink: {
    url: string;
    shouldIgnoreCache?: boolean;
  } & WithTabId;
  resolveBusinessChatLink: {
    slug: string;
  } & WithTabId;
  openChatByUsername: {
    username: string;
    threadId?: ThreadId;
    messageId?: number;
    commentId?: number;
    startParam?: string;
    startAttach?: string;
    attach?: string;
    startApp?: string;
    mode?: string;
    choose?: ApiChatType[];
    text?: string;
    originalParts?: (string | undefined)[];
    onChatChanged?: CallbackAction;
  } & WithTabId;
  processBoostParameters: {
    usernameOrId: string;
    isPrivate?: boolean;
  } & WithTabId;
  setScrollOffset: {
    chatId: string;
    threadId: ThreadId;
    scrollOffset: number;
  } & WithTabId;
  unpinAllMessages: {
    chatId: string;
    threadId: ThreadId;
  };
  setEditingId: {
    messageId?: number;
  } & WithTabId;
  editLastMessage: WithTabId | undefined;
  saveDraft: {
    chatId: string;
    threadId: ThreadId;
    text: ApiDraft['text'];
  };
  clearDraft: {
    chatId: string;
    threadId?: ThreadId;
    isLocalOnly?: boolean;
    shouldKeepReply?: boolean;
  };
  loadPinnedMessages: {
    chatId: string;
    threadId: ThreadId;
  };
  toggleMessageWebPage: {
    chatId: string;
    threadId: ThreadId;
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
  closeStarsPaymentModal: WithTabId | undefined;
  resetPaymentStatus: WithTabId | undefined;
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
  sendStarPaymentForm: {
    starGift?: {
      formId: string;
      inputInvoice: ApiInputInvoiceStarGift;
    };
  } & WithTabId;
  getReceipt: {
    chatId: string;
    messageId: number;
  } & WithTabId;
  openStarsTransactionModal: {
    transaction: ApiStarsTransaction;
  } & WithTabId;
  openStarsTransactionFromGift: {
    chatId: string;
    messageId: number;
  } & WithTabId;
  closeStarsTransactionModal: WithTabId | undefined;
  openStarsSubscriptionModal: {
    subscription: ApiStarsSubscription;
  } & WithTabId;
  closeStarsSubscriptionModal: WithTabId | undefined;
  openPrizeStarsTransactionFromGiveaway: {
    chatId: string;
    messageId: number;
  } & WithTabId;
  closePrizeStarsTransactionFromGiveaway: WithTabId | undefined;
  sendCredentialsInfo: {
    credentials: ApiCredentials;
  } & WithTabId;
  setSmartGlocalCardInfo: {
    type: string;
    token: string;
  } & WithTabId;
  clearPaymentError: WithTabId | undefined;
  clearReceipt: WithTabId | undefined;

  // stats
  toggleStatistics: WithTabId | undefined;
  toggleMessageStatistics: ({
    messageId?: number;
  } & WithTabId) | undefined;
  toggleStoryStatistics: ({
    storyId?: number;
  } & WithTabId) | undefined;
  loadStatistics: {
    chatId: string;
    isGroup: boolean;
  } & WithTabId;
  loadMessageStatistics: {
    chatId: string;
    messageId: number;
  } & WithTabId;
  loadMessagePublicForwards: {
    chatId: string;
    messageId: number;
  } & WithTabId;
  loadStoryStatistics: {
    chatId: string;
    storyId: number;
  } & WithTabId;
  loadStoryPublicForwards: {
    chatId: string;
    storyId: number;
  } & WithTabId;
  loadStatisticsAsyncGraph: {
    chatId: string;
    token: string;
    name: string;
    isPercentage?: boolean;
  } & WithTabId;
  loadChannelMonetizationStatistics: {
    peerId: string;
  } & WithTabId;

  loadMonetizationRevenueWithdrawalUrl: {
    peerId: string;
    currentPassword: string;
    onSuccess: VoidFunction;
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

  copySelectedMessages: WithTabId | undefined;
  copyMessagesByIds: {
    messageIds?: number[];
  } & WithTabId;
  openSeenByModal: {
    chatId: string;
    messageId: number;
  } & WithTabId;
  closeSeenByModal: WithTabId | undefined;
  openPrivacySettingsNoticeModal: {
    chatId: string;
    isReadDate: boolean;
  } & WithTabId;
  closePrivacySettingsNoticeModal: WithTabId | undefined;
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
  disableContextMenuHint: undefined;
  focusNextReply: WithTabId | undefined;

  openChatLanguageModal: {
    chatId: string;
    messageId?: number;
  } & WithTabId;
  closeChatLanguageModal: WithTabId | undefined;

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
  hideChatReportPane: {
    chatId: string;
  };
  toggleManagement: ({
    force?: boolean;
  } & WithTabId) | undefined;
  requestNextManagementScreen: ({
    screen?: ManagementScreens;
  } & WithTabId) | undefined;
  closeManagement: WithTabId | undefined;
  checkPublicLink: { username: string } & WithTabId;
  updatePublicLink: { username: string; shouldDisableUsernames?: boolean } & WithTabId;
  updatePrivateLink: WithTabId | undefined;
  resetManagementError: { chatId: string } & WithTabId;

  setShouldCloseRightColumn: {
    value?: boolean;
  } & WithTabId;
  requestChatUpdate: { chatId: string };
  requestSavedDialogUpdate: { chatId: string };
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
  focusMessage: {
    chatId: string;
    threadId?: ThreadId;
    messageListType?: MessageListType;
    messageId: number;
    noHighlight?: boolean;
    groupedId?: string;
    groupedChatId?: string;
    replyMessageId?: number;
    isResizingContainer?: boolean;
    shouldReplaceHistory?: boolean;
    noForumTopicPanel?: boolean;
    quote?: string;
    scrollTargetPosition?: ScrollTargetPosition;
  } & WithTabId;

  focusLastMessage: WithTabId | undefined;
  updateDraftReplyInfo: Partial<ApiInputMessageReplyInfo> & WithTabId;
  resetDraftReplyInfo: WithTabId | undefined;

  // Multitab
  destroyConnection: undefined;
  initShared: { force?: boolean } | undefined;
  switchMultitabRole: {
    isMasterTab: boolean;
  } & WithTabId;
  openChatInNewTab: {
    chatId: string;
    threadId?: ThreadId;
  };
  onTabFocusChange: {
    isBlurred: boolean;
  } & WithTabId;
  onSomeTabSwitchedMultitabRole: undefined;
  afterHangUp: undefined;
  requestMasterAndCallAction: CallbackAction & WithTabId;
  clearMultitabNextAction: WithTabId | undefined;
  requestMasterAndJoinGroupCall: ActionPayloads['joinGroupCall'];
  requestMasterAndRequestCall: ActionPayloads['requestCall'];
  requestMasterAndAcceptCall: WithTabId | undefined;

  // Initial
  signOut: { forceInitApi?: boolean } | undefined;
  requestChannelDifference: {
    chatId: string;
  };

  // Misc
  setInstallPrompt: { canInstall: boolean } & WithTabId;
  openLimitReachedModal: { limit: ApiLimitTypeWithModal } & WithTabId;
  closeLimitReachedModal: WithTabId | undefined;
  checkAppVersion: undefined;
  setIsElectronUpdateAvailable: boolean;
  setGlobalSearchClosing: ({
    isClosing?: boolean;
  } & WithTabId) | undefined;
  processPremiumFloodWait: {
    isUpload?: boolean;
  };

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
    isConfirmed?: boolean;
  };
  changeSessionTtl: {
    days: number;
  };

  // Chats
  loadChatSettings: {
    chatId: string;
  };
  fetchChat: {
    chatId: string;
  };
  loadChannelRecommendations: {
    chatId?: string;
  };
  toggleChannelRecommendations: {
    chatId: string;
  };
  updateChatMutedState: {
    chatId: string;
    isMuted?: boolean;
    muteUntil?: number;
  };

  updateChat: {
    chatId: string;
    title: string;
    about: string;
    photo?: File;
  } & WithTabId;
  updateChatDetectedLanguage: {
    chatId: string;
    detectedLanguage?: string;
  };
  toggleSignatures: {
    chatId: string;
    areSignaturesEnabled: boolean;
    areProfilesEnabled: boolean;
  };
  loadGroupsForDiscussion: undefined;
  linkDiscussionGroup: {
    channelId: string;
    chatId: string;
  } & WithTabId;
  unlinkDiscussionGroup: {
    channelId: string;
  };

  openSavedDialog: {
    chatId: string;
    shouldReplaceHistory?: boolean;
    shouldReplaceLast?: boolean;
    noForumTopicPanel?: boolean;
  } & WithTabId;
  openChat: {
    id: string | undefined;
    type?: MessageListType;
    shouldReplaceHistory?: boolean;
    shouldReplaceLast?: boolean;
    noForumTopicPanel?: boolean;
  } & WithTabId;
  openThread: {
    type?: MessageListType;
    shouldReplaceHistory?: boolean;
    shouldReplaceLast?: boolean;
    noForumTopicPanel?: boolean;
    focusMessageId?: number;
  } & ({
    isComments: true;
    chatId?: string;
    originMessageId: number;
    originChannelId: string;
  } | {
    isComments?: false;
    chatId: string;
    threadId: ThreadId;
  }) & WithTabId;
  // Used by both openThread & openChat
  processOpenChatOrThread: {
    chatId: string | undefined;
    threadId: ThreadId;
    type?: MessageListType;
    shouldReplaceHistory?: boolean;
    shouldReplaceLast?: boolean;
    noForumTopicPanel?: boolean;
    isComments?: boolean;
  } & WithTabId;
  loadFullChat: {
    chatId: string;
    withPhotos?: boolean;
    force?: boolean;
  };
  updateChatPhoto: {
    chatId: string;
    photo: ApiPhoto;
  };
  deleteChatPhoto: {
    chatId: string;
    photo: ApiPhoto;
  };
  openChatWithDraft: {
    chatId?: string;
    threadId?: ThreadId;
    text: ApiFormattedText;
    files?: File[];
    filter?: ApiChatType[];
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
  resetNextProfileTab: WithTabId | undefined;

  openForumPanel: {
    chatId: string;
  } & WithTabId;
  closeForumPanel: WithTabId | undefined;

  toggleParticipantsHidden: {
    chatId: string;
    isEnabled: boolean;
  };

  checkGiftCode: {
    slug: string;
    message?: {
      chatId: string;
      messageId: number;
    };
  } & WithTabId;
  applyGiftCode: {
    slug: string;
  } & WithTabId;
  closeGiftCodeModal: WithTabId | undefined;

  launchPrepaidGiveaway: {
    chatId: string;
    giveawayId: string;
    paymentPurpose: {
      additionalChannelIds?: string[];
      areWinnersVisible?: boolean;
      countries?: string[];
      prizeDescription?: string;
      untilDate: number;
      currency: string;
      amount: number;
    };
  } & WithTabId;

  launchPrepaidStarsGiveaway: {
    chatId: string;
    giveawayId: string;
    paymentPurpose: {
      additionalChannelIds?: string[];
      areWinnersVisible?: boolean;
      countries?: string[];
      prizeDescription?: string;
      untilDate: number;
      currency: string;
      stars: number;
      users: number;
      amount: number;
    };
  } & WithTabId;

  loadStarStatus: undefined;
  loadStarsTransactions: {
    type: StarsTransactionType;
  };
  loadStarsSubscriptions: undefined;
  changeStarsSubscription: {
    peerId?: string;
    id: string;
    isCancelled: boolean;
  };
  fulfillStarsSubscription: {
    peerId?: string;
    id: string;
  };
  openStarsBalanceModal: {
    originStarsPayment?: TabState['starsPayment'];
    originGift?: StarGiftInfo;
    originReaction?: {
      chatId: string;
      messageId: number;
      amount: number;
    };
    topup?: {
      balanceNeeded: number;
      purpose?: string;
    };
    shouldIgnoreBalance?: boolean;
  } & WithTabId;
  closeStarsBalanceModal: WithTabId | undefined;

  checkChatlistInvite: {
    slug: string;
  } & WithTabId;
  joinChatlistInvite: {
    invite: ApiChatlistInvite;
    peerIds: string[];
  } & WithTabId;
  leaveChatlist: {
    folderId: number;
    peerIds?: string[];
  } & WithTabId;
  closeChatlistModal: WithTabId | undefined;
  loadChatlistInvites: {
    folderId: number;
  };
  createChatlistInvite: {
    folderId: number;
  } & WithTabId;
  editChatlistInvite: {
    folderId: number;
    url: string;
    peerIds: string[];
  } & WithTabId;
  deleteChatlistInvite: {
    folderId: number;
    url: string;
  } & WithTabId;

  requestChatTranslation: {
    chatId: string;
    toLanguageCode?: string;
  } & WithTabId;

  togglePeerTranslations: {
    chatId: string;
    isEnabled: boolean;
  };

  // Messages
  setEditingDraft: {
    text?: ApiFormattedText;
    chatId: string;
    threadId: ThreadId;
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
  scheduleForViewsIncrement: {
    chatId: string;
    ids: number[];
  };
  loadMessageViews: {
    chatId: string;
    ids: number[];
    shouldIncrement?: boolean;
  };
  loadFactChecks: {
    chatId: string;
    ids: number[];
  };
  loadOutboxReadDate: {
    chatId: string;
    messageId: number;
  };
  loadQuickReplies: undefined;
  sendQuickReply: {
    chatId: string;
    quickReplyId: number;
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
  copyMessageLink: {
    chatId: string;
    messageId: number;
    shouldIncludeThread?: boolean;
    shouldIncludeGrouped?: boolean;
  } & WithTabId;

  loadPaidReactionPrivacy: undefined;

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

  requestMessageTranslation: {
    chatId: string;
    id: number;
    toLanguageCode?: string;
  } & WithTabId;

  showOriginalMessage: {
    chatId: string;
    id: number;
  } & WithTabId;

  markMessagesTranslationPending: {
    chatId: string;
    messageIds: number[];
    toLanguageCode?: string;
  };
  translateMessages: {
    chatId: string;
    messageIds: number[];
    toLanguageCode?: string;
  };

  // Reactions
  loadTopReactions: undefined;
  loadRecentReactions: undefined;
  loadAvailableReactions: undefined;
  loadDefaultTagReactions: undefined;
  clearRecentReactions: undefined;
  loadSavedReactionTags: undefined;
  editSavedReactionTag: {
    reaction: ApiReaction;
    title?: string;
  };

  loadMessageReactions: {
    chatId: string;
    ids: number[];
  };

  toggleReaction: {
    chatId: string;
    messageId: number;
    reaction: ApiReaction;
    shouldAddToRecent?: boolean;
  } & WithTabId;

  sendPaidReaction: {
    chatId: string;
    messageId: number;
    forcedAmount?: number;
    isPrivate?: boolean;
  } & WithTabId;
  addLocalPaidReaction: {
    chatId: string;
    messageId: number;
    count: number;
    isPrivate?: boolean;
  } & WithTabId;
  resetLocalPaidReactions: {
    chatId: string;
    messageId: number;
  };

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
    reactionsLimit?: number;
  };

  startActiveReaction: {
    containerId: string;
    reaction: ApiReactionWithPaid;
  } & WithTabId;
  stopActiveReaction: {
    containerId: string;
    reaction?: ApiReactionWithPaid;
  } & WithTabId;

  openEffectPicker: {
    chatId: string;
    position: IAnchorPosition;
  } & WithTabId;
  openMessageReactionPicker: {
    chatId: string;
    messageId: number;
    position: IAnchorPosition;
  } & WithTabId;
  openStoryReactionPicker: {
    peerId: string;
    storyId: number;
    position: IAnchorPosition;
    sendAsMessage?: boolean;
  } & WithTabId;
  closeReactionPicker: WithTabId | undefined;

  // Stories
  loadAllStories: undefined;
  loadAllHiddenStories: undefined;
  loadPeerStories: {
    peerId: string;
  };
  loadPeerProfileStories: {
    peerId: string;
    offsetId?: number;
  } & WithTabId;
  loadStoriesArchive: {
    peerId: string;
    offsetId?: number;
  } & WithTabId;
  loadPeerSkippedStories: {
    peerId: string;
  } & WithTabId;
  loadPeerStoriesByIds: {
    peerId: string;
    storyIds: number[];
  } & WithTabId;
  viewStory: {
    peerId: string;
    storyId: number;
  } & WithTabId;
  deleteStory: {
    peerId: string;
    storyId: number;
  } & WithTabId;
  toggleStoryInProfile: {
    peerId: string;
    storyId: number;
    isInProfile?: boolean;
  };
  toggleStoryPinnedToTop: {
    peerId: string;
    storyId: number;
  };
  toggleStoryRibbon: {
    isShown: boolean;
    isArchived?: boolean;
  } & WithTabId;
  openStoryViewer: {
    peerId: string;
    storyId?: number;
    isSinglePeer?: boolean;
    isSingleStory?: boolean;
    isPrivate?: boolean;
    isArchive?: boolean;
    origin?: StoryViewerOrigin;
  } & WithTabId;
  openStoryViewerByUsername: {
    username: string;
    storyId: number;
    origin?: StoryViewerOrigin;
  } & WithTabId;
  openPreviousStory: WithTabId | undefined;
  openNextStory: WithTabId | undefined;
  setStoryViewerMuted: {
    isMuted: boolean;
  } & WithTabId;
  closeStoryViewer: WithTabId | undefined;
  loadStoryViews: {
    peerId: string;
    storyId: number;
  };
  loadStoryViewList: ({
    peerId: string;
    storyId: number;
    offset?: string;
    query?: string;
    limit?: number;
    areJustContacts?: true;
    areReactionsFirst?: true;
  }) & WithTabId;
  clearStoryViews: {
    isLoading?: boolean;
  } & WithTabId;
  updateStoryView: {
    userId: string;
    isUserBlocked?: boolean;
    areStoriesBlocked?: boolean;
  } & WithTabId;
  openStoryViewModal: {
    storyId: number;
  } & WithTabId;
  closeStoryViewModal: WithTabId | undefined;
  copyStoryLink: {
    peerId: string;
    storyId: number;
  } & WithTabId;
  reportStory: {
    peerId: string;
    option?: string;
    storyId: number;
    description?: string;
  } & WithTabId;
  openStoryPrivacyEditor: WithTabId | undefined;
  closeStoryPrivacyEditor: WithTabId | undefined;
  editStoryPrivacy: {
    peerId: string;
    storyId: number;
    privacy: ApiPrivacySettings;
  };
  toggleStoriesHidden: {
    peerId : string;
    isHidden: boolean;
  };
  loadStoriesMaxIds: {
    peerIds: string[];
  };
  sendStoryReaction: {
    peerId: string;
    storyId: number;
    containerId: string;
    reaction?: ApiReaction;
    shouldAddToRecent?: boolean;
  } & WithTabId;
  toggleStealthModal: {
    isOpen: boolean;
  } & WithTabId;
  activateStealthMode: {
    isForPast?: boolean;
    isForFuture?: boolean;
  } | undefined;

  openBoostModal: {
    chatId: string;
  } & WithTabId;
  closeBoostModal: WithTabId | undefined;
  openBoostStatistics: {
    chatId: string;
  } & WithTabId;
  closeBoostStatistics: WithTabId | undefined;
  loadMoreBoosters: { isGifts?: boolean } & WithTabId | undefined;
  applyBoost: {
    slots: number[];
    chatId: string;
  } & WithTabId;

  openMonetizationStatistics: {
    chatId: string;
  } & WithTabId;
  closeMonetizationStatistics: WithTabId | undefined;

  // Media Viewer & Audio Player
  openMediaViewer: {
    chatId?: string;
    threadId?: ThreadId;
    messageId?: number;
    standaloneMedia?: MediaViewerMedia[];
    mediaIndex?: number;
    isAvatarView?: boolean;
    isSponsoredMessage?: boolean;
    origin: MediaViewerOrigin;
    withDynamicLoading?: boolean;
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
    threadId?: ThreadId;
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
  downloadMedia: {
    media: DownloadableMedia;
    originMessage?: ApiMessage;
  } & WithTabId;
  cancelMediaDownload: {
    media: DownloadableMedia;
  } & WithTabId;
  cancelMediaHashDownloads: {
    mediaHashes: string[];
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
  updateBotProfile: {
    photo?: File;
    firstName?: string;
    bio?: string;
  } & WithTabId;
  setBotInfo: {
    bot?: ApiUser | undefined;
    langCode?: string;
    name?: string | undefined;
    about?: string | undefined;
    description?: string | undefined;
    isMuted?: boolean;
  } & WithTabId;
  startBotFatherConversation: {
    param: string;
  } & WithTabId;
  checkUsername: {
    username: string;
  } & WithTabId;

  deleteContact: { userId: string };
  loadUser: { userId: string };
  setUserSearchQuery: { query?: string } & WithTabId;
  loadCommonChats: {
    userId: string;
  };
  reportSpam: { chatId: string };
  loadFullUser: { userId: string; withPhotos?: boolean };
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
  loadMoreProfilePhotos: {
    peerId: string;
    isPreload?: boolean;
    shouldInvalidateCache?: boolean;
  };
  deleteProfilePhoto: {
    photo: ApiPhoto;
  };
  updateProfilePhoto: {
    photo: ApiPhoto;
    isFallback?: boolean;
  };
  // Composer
  setShouldPreventComposerAnimation: {
    shouldPreventComposerAnimation: boolean;
  } & WithTabId;

  // Replies
  openReplyMenu: {
    fromChatId: string;
    messageId?: number;
    quoteText?: ApiFormattedText;
  } & WithTabId;

  // Forwards
  openForwardMenu: {
    fromChatId: string;
    messageIds?: number[];
    storyId?: number;
    groupedId?: string;
    withMyScore?: boolean;
  } & WithTabId;
  openForwardMenuForSelectedMessages: WithTabId | undefined;
  setForwardChatOrTopic: {
    chatId: string;
    topicId?: number;
  } & WithTabId;
  openChatOrTopicWithReplyInDraft: {
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
  changeRecipient: WithTabId | undefined;
  forwardToSavedMessages: WithTabId | undefined;
  forwardStory: {
    toChatId: string;
  } & WithTabId;

  // GIFs
  loadSavedGifs: undefined;

  // Stickers
  loadStickers: {
    stickerSetInfo: ApiStickerSetInfo;
  };
  loadAnimatedEmojis: undefined;
  loadGreetingStickers: undefined;
  loadGenericEmojiEffects: undefined;
  loadBirthdayNumbersStickers: undefined;
  loadRestrictedEmojiStickers: undefined;

  loadAvailableEffects: undefined;

  addRecentSticker: {
    sticker: ApiSticker;
  };

  removeRecentSticker: {
    sticker: ApiSticker;
  };

  clearRecentStickers: undefined;

  loadStickerSets: undefined;
  loadAddedStickers: undefined;
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

  openStickerSet: {
    stickerSetInfo: ApiStickerSetInfo;
    shouldIgnoreCache?: boolean;
  } & WithTabId;
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
  loadTopBotApps: undefined;
  queryInlineBot: {
    chatId: string;
    username: string;
    query: string;
    offset?: string;
  } & WithTabId;
  sendInlineBotResult: {
    id: string;
    queryId: string;
    messageList: MessageList;
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
  sharePhoneWithBot: {
    botId: string;
  };

  clickBotInlineButton: {
    chatId: string;
    messageId: number;
    button: ApiKeyboardButton;
  } & WithTabId;

  switchBotInline: {
    messageId?: number;
    botId?: string;
    query: string;
    isSamePeer?: boolean;
    filter?: ApiChatType[];
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
    isFullscreen?: boolean;
  } & WithTabId;
  updateWebApp: {
    key: string;
    update: Partial<WebApp>;
  } & WithTabId;
  requestMainWebView: {
    botId: string;
    peerId: string;
    theme?: ApiThemeParameters;
    startParam?: string;
    mode?: string;
    shouldMarkBotTrusted?: boolean;
  } & WithTabId;
  prolongWebView: {
    botId: string;
    peerId: string;
    queryId: string;
    isSilent?: boolean;
    replyInfo?: ApiInputMessageReplyInfo;
    threadId?: ThreadId;
  } & WithTabId;
  requestSimpleWebView: {
    url?: string;
    botId: string;
    buttonText: string;
    theme?: ApiThemeParameters;
    startParam?: string;
    isFromSwitchWebView?: boolean;
    isFromSideMenu?: boolean;
  } & WithTabId;
  requestAppWebView: {
    botId: string;
    appName: string;
    theme?: ApiThemeParameters;
    startApp?: string;
    mode?: string;
    isWriteAllowed?: boolean;
    isFromConfirm?: boolean;
    shouldSkipBotTrustRequest?: boolean;
  } & WithTabId;
  openWebAppTab: {
    webApp?: WebApp;
  } & WithTabId;
  loadPreviewMedias: {
    botId: string;
  };
  setWebAppPaymentSlug: {
    slug?: string;
  } & WithTabId;

  cancelBotTrustRequest: WithTabId | undefined;
  markBotTrusted: {
    botId: string;
    isWriteAllowed?: boolean;
  } & WithTabId;

  cancelAttachBotInstall: WithTabId | undefined;
  confirmAttachBotInstall: {
    isWriteAllowed: boolean;
  } & WithTabId;

  processAttachBotParameters: {
    username: string;
    filter?: ApiChatType[];
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

  loadAttachBots: undefined;

  toggleAttachBot: {
    botId: string;
    isWriteAllowed?: boolean;
    isEnabled: boolean;
  };

  callAttachBot: ({
    chatId: string;
    threadId?: ThreadId;
    url?: string;
  } | {
    isFromSideMenu: true;
  }) & {
    startParam?: string;
    bot?: ApiAttachBot;
    isFromConfirm?: boolean;
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
  };
  sortChatUsernames: {
    chatId: string;
    usernames: string[];
  };
  closeActiveWebApp: WithTabId | undefined;
  openMoreAppsTab: WithTabId | undefined;
  closeMoreAppsTab: WithTabId | undefined;
  closeWebApp: {
    key: string;
    skipClosingConfirmation?: boolean;
  } & WithTabId;
  sendWebAppEvent: {
    webAppKey: string;
    event: WebAppOutboundEvent;
  } & WithTabId;
  closeWebAppModal: ({
    shouldSkipConfirmation?: boolean;
  } & WithTabId) | undefined;
  changeWebAppModalState: {
    state: WebAppModalStateType;
  } & WithTabId;

  // Misc
  refreshLangPackFromCache: {
    langCode: string;
  };
  openPollModal: ({
    isQuiz?: boolean;
  } & WithTabId) | undefined;
  closePollModal: WithTabId | undefined;
  requestConfetti: (ConfettiParams & WithTabId) | WithTabId;
  requestWave: {
    startX: number;
    startY: number;
  } & WithTabId;

  updateAttachmentSettings: {
    shouldCompress?: boolean;
    shouldSendGrouped?: boolean;
    isInvertedMedia?: true;
    webPageMediaSize?: WebPageMediaSize;
  };

  saveEffectInDraft: {
    chatId: string;
    threadId: ThreadId;
    effectId?: string;
  };

  setReactionEffect: {
    chatId: string;
    threadId: ThreadId;
    reaction?: ApiReaction;
  } & WithTabId;

  requestEffectInComposer: WithTabId;
  hideEffectInComposer: WithTabId;

  updateArchiveSettings: {
    isMinimized?: boolean;
    isHidden?: boolean;
  };

  openUrl: {
    url: string;
    shouldSkipModal?: boolean;
    ignoreDeepLinks?: boolean;
  } & WithTabId;
  openMapModal: {
    geoPoint: ApiGeoPoint;
    zoom?: number;
  } & WithTabId;
  closeMapModal: WithTabId | undefined;
  toggleSafeLinkModal: {
    url?: string;
  } & WithTabId;
  closeUrlAuthModal: WithTabId | undefined;
  showNotification: Omit<ApiNotification, 'localId'> & { localId?: string } & WithTabId;
  showAllowedMessageTypesNotification: {
    chatId: string;
  } & WithTabId;
  dismissNotification: { localId: string } & WithTabId;

  updatePageTitle: WithTabId | undefined;
  closeInviteViaLinkModal: WithTabId | undefined;

  openOneTimeMediaModal: TabState['oneTimeMediaModal'] & WithTabId;
  closeOneTimeMediaModal: WithTabId | undefined;

  requestCollectibleInfo: {
    peerId: string;
    type : 'phone' | 'username';
    collectible: string;
  } & WithTabId;
  closeCollectibleInfoModal: WithTabId | undefined;

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
  } | undefined;
  toggleGroupCallPresentation: {
    value?: boolean;
  } | undefined;
  leaveGroupCall: ({
    isFromLibrary?: boolean;
    shouldDiscard?: boolean;
    shouldRemove?: boolean;
    rejoin?: ActionPayloads['joinGroupCall'];
    isPageUnload?: boolean;
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
  hangUp: ({ isPageUnload?: boolean } & WithTabId) | undefined;
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
  setPasscode: { passcode: string } & WithTabId;
  clearPasscode: undefined;
  lockScreen: undefined;
  unlockScreen: { sessionJson: string; globalJson: string };
  softSignIn: undefined;
  logInvalidUnlockAttempt: undefined;
  resetInvalidUnlockAttempts: undefined;
  setPasscodeError: { error: string };
  clearPasscodeError: undefined;
  skipLockOnUnload: undefined;

  // Settings
  updateShouldDebugExportedSenders: undefined;
  updateShouldEnableDebugLog: undefined;
  loadConfig: undefined;
  loadAppConfig: {
    hash: number;
  } | undefined;
  loadPeerColors: undefined;
  loadTimezones: undefined;
  requestNextSettingsScreen: {
    screen?: SettingsScreens;
    foldersAction?: ReducerAction<FoldersActions>;
  } & WithTabId;
  sortChatFolders: { folderIds: number[] };
  closeDeleteChatFolderModal: WithTabId | undefined;
  openDeleteChatFolderModal: {
    folderId: number;
    isConfirmedForChatlist?: boolean;
  } & WithTabId;
  openShareChatFolderModal: {
    folderId: number;
    url?: string;
    noRequestNextScreen?: boolean;
  } & WithTabId;
  openEditChatFolder: {
    folderId: number;
    isOnlyInvites?: boolean;
  } & WithTabId;
  closeShareChatFolderModal: undefined | WithTabId;
  loadGlobalPrivacySettings: undefined;
  updateGlobalPrivacySettings: {
    shouldArchiveAndMuteNewNonContact?: boolean;
    shouldHideReadMarks?: boolean;
    shouldNewNonContactPeersRequirePremium?: boolean;
  };

  // Premium
  openPremiumModal: ({
    initialSection?: ApiPremiumSection;
    fromUserId?: string;
    toUserId?: string;
    isSuccess?: boolean;
    isGift?: boolean;
    monthsAmount?: number;
  } & WithTabId) | undefined;
  closePremiumModal: WithTabId | undefined;

  openGiveawayModal: ({
    chatId: string;
    gifts?: number[] | undefined;
    prepaidGiveaway?: ApiTypePrepaidGiveaway | undefined;
  } & WithTabId);
  closeGiveawayModal: WithTabId | undefined;

  openGiftRecipientPicker: WithTabId | undefined;
  closeGiftRecipientPicker: WithTabId | undefined;

  openWebAppsCloseConfirmationModal: WithTabId | undefined;

  closeWebAppsCloseConfirmationModal: ({
    shouldSkipInFuture?: boolean;
  } & WithTabId);

  openStarsGiftingPickerModal: WithTabId | undefined;
  closeStarsGiftingPickerModal: WithTabId | undefined;

  openPaidReactionModal: {
    chatId: string;
    messageId: number;
  } & WithTabId;
  closePaidReactionModal: WithTabId | undefined;

  openDeleteMessageModal: ({
    message?: ApiMessage;
    isSchedule?: boolean;
    album?: IAlbum;
    onConfirm?: NoneToVoidFunction;
  } & WithTabId);
  closeDeleteMessageModal: WithTabId | undefined;

  transcribeAudio: {
    chatId: string;
    messageId: number;
  };

  loadPremiumGifts: undefined;
  loadStarGifts: undefined;
  loadDefaultTopicIcons: undefined;
  loadPremiumStickers: undefined;

  openGiftModal: {
    forUserId: string;
  } & WithTabId;
  closeGiftModal: WithTabId | undefined;
  sendStarGift: StarGiftInfo & WithTabId;
  openGiftInfoModalFromMessage: {
    chatId: string;
    messageId: number;
  } & WithTabId;
  openGiftInfoModal: ({
    userId: string;
    gift: ApiUserStarGift;
  } | {
    gift: ApiStarGift;
  }) & WithTabId;
  closeGiftInfoModal: WithTabId | undefined;
  loadUserGifts: {
    userId: string;
    shouldRefresh?: boolean;
  };
  changeGiftVisilibity: {
    userId: string;
    messageId: number;
    shouldUnsave?: boolean;
  };
  convertGiftToStars: {
    userId: string;
    messageId: number;
  } & WithTabId;

  openStarsGiftModal: ({
    chatId?: string;
    forUserId?: string;
  } & WithTabId) | undefined;
  closeStarsGiftModal: WithTabId | undefined;

  setEmojiStatus: {
    emojiStatusId: string;
    expires?: number;
    referrerWebAppKey?: string;
  } & WithTabId;
  openSuggestedStatusModal: {
    botId: string;
    webAppKey?: string;
    customEmojiId: string;
    duration?: number;
  } & WithTabId;
  closeSuggestedStatusModal: WithTabId | undefined;

  // Invoice
  openInvoice: Exclude<ApiInputInvoice, ApiInputInvoiceStarGift> & WithTabId;

  // Payment
  validatePaymentPassword: {
    password: string;
  } & WithTabId;

  processOriginStarsPayment: {
    originData: TabState['starsBalanceModal'];
    status: ApiPaymentStatus;
  } & WithTabId;

  // Forums
  toggleForum: {
    chatId: string;
    isEnabled: boolean;
  } & WithTabId;
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
    isMuted?: boolean;
    muteUntil?: number;
  };
  setViewForumAsMessages: {
    chatId: string;
    isEnabled: boolean;
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
export type ActionReturnType = GlobalState | void | Promise<void>;
export type TabArgs<T> = T extends RequiredGlobalState ? [
  tabId: number,
] : [
  tabId?: number | undefined,
];
