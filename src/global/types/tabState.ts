import type {
  ApiAttachBot,
  ApiBoost,
  ApiBoostsStatus,
  ApiChannelMonetizationStatistics,
  ApiChannelStatistics,
  ApiChatInviteInfo,
  ApiChatlistInvite,
  ApiChatType,
  ApiCheckedGiftCode,
  ApiCollectibleInfo,
  ApiContact,
  ApiError,
  ApiFormattedText,
  ApiGeoPoint,
  ApiGlobalMessageSearchType,
  ApiGroupStatistics,
  ApiInputInvoice,
  ApiLimitTypeWithModal,
  ApiMessage,
  ApiMissingInvitedUser,
  ApiMyBoost,
  ApiNewPoll,
  ApiNotification,
  ApiPaymentFormRegular,
  ApiPaymentFormStars,
  ApiPaymentStatus,
  ApiPhoneCall,
  ApiPostStatistics,
  ApiPremiumGiftCodeOption,
  ApiPremiumPromo,
  ApiPremiumSection,
  ApiReactionWithPaid,
  ApiReceiptRegular,
  ApiSavedGifts,
  ApiSavedStarGift,
  ApiStarGift,
  ApiStarGiftAttribute,
  ApiStarGiveawayOption,
  ApiStarsSubscription,
  ApiStarsTransaction,
  ApiStarTopupOption,
  ApiSticker,
  ApiTypePrepaidGiveaway,
  ApiTypeStoryView,
  ApiUser,
  ApiVideo,
  ApiWebPage,
} from '../../api/types';
import type { ApiEmojiStatusCollectible } from '../../api/types/users';
import type { FoldersActions } from '../../hooks/reducers/useFoldersReducer';
import type { ReducerAction } from '../../hooks/useReducer';
import type {
  ActiveDownloads,
  ActiveEmojiInteraction,
  AudioOrigin,
  ChatCreationProgress,
  ChatMediaSearchParams,
  ChatRequestedTranslations,
  ConfettiStyle,
  FocusDirection,
  GiftProfileFilterOptions,
  GlobalSearchContent,
  IAnchorPosition,
  InlineBotSettings,
  ManagementProgress,
  ManagementState,
  MediaViewerMedia,
  MediaViewerOrigin,
  MessageList,
  MiddleSearchParams,
  NewChatMembersProgress,
  PaymentStep,
  ProfileEditProgress,
  ProfileTabType,
  ScrollTargetPosition,
  SettingsScreens,
  SharedMediaType,
  ShippingOption,
  StarGiftInfo,
  StoryViewerOrigin,
  TabThread,
  ThreadId,
} from '../../types';
import type { WebApp, WebAppModalStateType } from '../../types/webapp';
import type { SearchResultKey } from '../../util/keys/searchResultKey';
import type { RegularLangFnParameters } from '../../util/localization';
import type { CallbackAction } from './actions';

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

  recoveryEmail?: string;

  inlineBots: {
    isLoading: boolean;
    byUsername: Record<string, false | InlineBotSettings>;
  };

  savedGifts: {
    giftsByPeerId: Record<string, ApiSavedGifts>;
    filter: GiftProfileFilterOptions;
    transitionKey?: number;
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
      messageKey?: RegularLangFnParameters;
      descriptionKey?: RegularLangFnParameters;
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

  emojiStatusAccessModal?: {
    bot: ApiUser;
    webAppKey: string;
  };

  locationAccessModal?: {
    bot: ApiUser;
    webAppKey: string;
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
    chatId: string;
    messageIds: number[];
    isSchedule?: boolean;
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
    forPeerId: string;
    gifts?: ApiPremiumGiftCodeOption[];
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

  collectibleInfoModal?: ApiCollectibleInfo & {
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
    peerId?: string;
    gift: ApiSavedStarGift | ApiStarGift;
  };

  giftTransferModal?: {
    gift: ApiSavedStarGift;
  };

  giftUpgradeModal?: {
    sampleAttributes: ApiStarGiftAttribute[];
    recipientId?: string;
    gift?: ApiSavedStarGift;
  };

  giftWithdrawModal?: {
    gift: ApiSavedStarGift;
    isLoading?: boolean;
    errorKey?: RegularLangFnParameters;
  };

  giftStatusInfoModal?: {
    emojiStatus: ApiEmojiStatusCollectible;
  };

  suggestedStatusModal?: {
    botId: string;
    webAppKey?: string;
    customEmojiId: string;
    duration?: number;
  };

  monetizationVerificationModal?: {
    chatId: string;
    isLoading?: boolean;
    errorKey?: RegularLangFnParameters;
  };

  isWaitingForStarGiftUpgrade?: true;
  isWaitingForStarGiftTransfer?: true;
};
