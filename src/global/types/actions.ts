import type {
  ApiAttachBot,
  ApiAttachment,
  ApiChat,
  ApiChatAdminRights,
  ApiChatBannedRights,
  ApiChatFolder,
  ApiChatlistInvite,
  ApiChatReactions,
  ApiChatType,
  ApiDisallowedGiftsSettings,
  ApiDraft,
  ApiEmojiStatusCollectible,
  ApiEmojiStatusType,
  ApiExportedInvite,
  ApiFormattedText,
  ApiGeoPoint,
  ApiGlobalMessageSearchType,
  ApiInputInvoice,
  ApiInputInvoiceStarGift,
  ApiInputMessageReplyInfo,
  ApiInputSavedStarGift,
  ApiInputSuggestedPostInfo,
  ApiKeyboardButton,
  ApiKeyboardButtonSuggestedMessage,
  ApiLimitTypeWithModal,
  ApiMessage,
  ApiMessageEntity,
  ApiMessageSearchContext,
  ApiNewMediaTodo,
  ApiNotification,
  ApiNotifyPeerType,
  ApiPaymentStatus,
  ApiPeer,
  ApiPhoto,
  ApiPremiumSection,
  ApiPreparedInlineMessage,
  ApiPrivacyKey,
  ApiPrivacySettings,
  ApiProfileTab,
  ApiReaction,
  ApiReactionWithPaid,
  ApiReportReason,
  ApiSavedStarGift,
  ApiSendMessageAction,
  ApiSessionData,
  ApiStarGift,
  ApiStarGiftAttributeOriginalDetails,
  ApiStarGiftUnique,
  ApiStarsSubscription,
  ApiStarsTransaction,
  ApiSticker,
  ApiStickerSet,
  ApiStickerSetInfo,
  ApiThemeParameters,
  ApiTodoItem,
  ApiTypeCurrencyAmount,
  ApiTypePrepaidGiveaway,
  ApiUpdate,
  ApiUser,
  ApiVideo,
  BotsPrivacyType,
  LinkContext,
  PrivacyVisibility,
} from '../../api/types';
import type { ApiCredentials } from '../../components/payment/PaymentModal';
import type { FoldersActions } from '../../hooks/reducers/useFoldersReducer';
import type { ReducerAction } from '../../hooks/useReducer';
import type { P2pMessage } from '../../lib/secret-sauce';
import type {
  AccountSettings,
  AttachmentCompression,
  AudioOrigin,
  CallSound,
  ChatListType,
  ConfettiParams,
  GiftProfileFilterOptions,
  GlobalSearchContent,
  IAnchorPosition,
  IThemeSettings,
  LeftColumnContent,
  LoadMoreDirection,
  ManagementScreens,
  MediaViewerMedia,
  MediaViewerOrigin,
  MessageList,
  MessageListType,
  MiddleSearchParams,
  NewChatMembersProgress,
  PaymentStep,
  PerformanceType,
  Point,
  ProfileTabType,
  ResaleGiftsFilterOptions,
  ScrollTargetPosition,
  SendMessageParams,
  SettingsScreens,
  SharedMediaType,
  Size,
  StarGiftInfo,
  StarsTransactionType,
  StoryViewerOrigin,
  ThemeKey,
  ThreadId,
  WebPageMediaSize,
} from '../../types';
import type { WebApp, WebAppModalStateType, WebAppOutboundEvent } from '../../types/webapp';
import type { DownloadableMedia } from '../helpers';
import type { SharedState } from './sharedState';
import type { TabState } from './tabState';

export type WithTabId = { tabId?: number };

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
  setAuthRememberMe: { value: boolean };
  clearAuthErrorKey: undefined;
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
  setSettingOption: Partial<AccountSettings> | undefined;
  setSharedSettingOption: Partial<SharedState['settings']> | undefined;
  updatePerformanceSettings: Partial<PerformanceType>;
  loadPasswordInfo: undefined;
  clearTwoFaError: undefined;
  openMonetizationVerificationModal: {
    chatId: string;
  } & WithTabId;
  clearMonetizationVerificationError: WithTabId | undefined;
  closeMonetizationVerificationModal: WithTabId | undefined;
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
  } & WithTabId;
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
    peerType: ApiNotifyPeerType;
    isMuted?: boolean;
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
    botsPrivacy: BotsPrivacyType;
  };
  loadNotificationExceptions: undefined;
  setThemeSettings: { theme: ThemeKey } & Partial<IThemeSettings>;
  updateIsOnline: { isOnline: boolean };

  loadContentSettings: undefined;
  updateContentSettings: { isSensitiveEnabled: boolean };

  loadCountryList: {
    langCode?: string;
  };
  ensureTimeFormat: undefined;

  // misc
  loadWebPagePreview: {
    text: ApiFormattedText;
  } & WithTabId;
  clearWebPagePreview: WithTabId | undefined;
  loadWallpapers: undefined;
  uploadWallpaper: File;
  setDeviceToken: { token: string };
  deleteDeviceToken: undefined;
  checkVersionNotification: undefined;
  createServiceNotification: {
    message: ApiMessage;
    version?: string;
  };
  saveCloseFriends: {
    userIds: string[];
  };
  markBotVerificationInfoShown: {
    peerId: string;
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
    mediaType?: SharedMediaType;
  } & WithTabId;
  searchSharedMediaMessages: WithTabId | undefined;
  searchChatMediaMessages: {
    currentMediaMessageId: number;
    direction?: LoadMoreDirection;
    chatId?: string;
    threadId?: ThreadId;
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
    listType: ChatListType;
    whenFirstBatchDone?: () => Promise<void>;
  };
  loadPinnedDialogs: {
    listType: ChatListType;
  };
  openChatWithInfo: ActionPayloads['openChat'] & {
    profileTab?: ProfileTabType;
    forceScrollProfileTab?: boolean;
    isOwnProfile?: boolean;
  } & WithTabId;
  openThreadWithInfo: ActionPayloads['openThread'] & {
    profileTab?: ProfileTabType;
    forceScrollProfileTab?: boolean;
    isOwnProfile?: boolean;
  } & WithTabId;
  openLinkedChat: { id: string } & WithTabId;
  loadMoreMembers: {
    chatId: string;
  };
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
  markChatUnread: { id: string };
  markChatRead: { id: string };
  markChatMessagesRead: { id: string };
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
  toggleDialogFilterTags: {
    isEnabled: boolean;
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
    context?: ApiMessageSearchContext;
    shouldResetResultsByType?: boolean;
    shouldCheckFetchingMessagesStatus?: boolean;
  } & WithTabId;
  searchPopularBotApps: WithTabId | undefined;
  checkSearchPostsFlood: {
    query?: string;
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
    threadId?: ThreadId;
    shouldForceRender?: boolean;
    forceLastSlice?: boolean;
    onLoaded?: NoneToVoidFunction;
    onError?: NoneToVoidFunction;
  } & WithTabId;
  sendMessage: Partial<SendMessageParams> & WithTabId;
  sendMessages: {
    sendParams: SendMessageParams[];
  };
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
    messageList?: MessageList;
  } & WithTabId;
  resetLocalPaidMessages: WithTabId | undefined;
  deleteParticipantHistory: {
    peerId: string;
    chatId: string;
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
  loadMessagesById: {
    chatId: string;
    messageIds: number[];
  };
  editMessage: {
    messageList?: MessageList;
    text: string;
    attachments?: ApiAttachment[];
    entities?: ApiMessageEntity[];
  } & WithTabId;
  editTodo: {
    chatId: string;
    todo: ApiNewMediaTodo;
    messageId: number;
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
  viewSponsored: {
    randomId: string;
  };
  clickSponsored: {
    randomId: string;
    isMedia?: boolean;
    isFullscreen?: boolean;
  };
  reportSponsored: {
    peerId?: string;
    randomId: string;
    option?: string;
  } & WithTabId;
  openAboutAdsModal: {
    randomId: string;
    canReport?: boolean;
    sponsorInfo?: string;
    additionalInfo?: string;
  } & WithTabId;
  closeAboutAdsModal: WithTabId | undefined;
  openPreparedInlineMessageModal: {
    botId: string;
    messageId: string;
    webAppKey: string;
  } & WithTabId;
  closePreparedInlineMessageModal: WithTabId | undefined;
  openSharePreparedMessageModal: {
    webAppKey: string;
    message: ApiPreparedInlineMessage;
  } & WithTabId;
  closeSharePreparedMessageModal: WithTabId | undefined;
  updateSharePreparedMessageModalSendArgs: {
    args?: {
      peerId: string;
      threadId?: ThreadId;
    };
  } & WithTabId;
  openPreviousReportAdModal: WithTabId | undefined;
  openPreviousReportModal: WithTabId | undefined;
  closeReportAdModal: WithTabId | undefined;
  closeReportModal: WithTabId | undefined;
  hideSponsored: WithTabId | undefined;
  loadSendAs: {
    chatId: string;
  };
  loadSendPaidReactionsAs: {
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
  approveSuggestedPost: {
    chatId: string;
    messageId: number;
    scheduleDate?: number;
  } & WithTabId;

  confirmApproveSuggestedPost: {
    chatId: string;
    messageId: number;
  } & WithTabId;
  rejectSuggestedPost: {
    chatId: string;
    messageId: number;
    rejectComment?: string;
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
    linkContext?: LinkContext;
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
    ref?: string;
    startAttach?: string;
    attach?: string;
    startApp?: string;
    shouldStartMainApp?: boolean;
    mode?: string;
    choose?: ApiChatType[];
    text?: string;
    originalParts?: (string | undefined)[];
    timestamp?: number;
    onChatChanged?: CallbackAction;
    linkContext?: LinkContext;
    isDirect?: boolean;
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
    shouldKeepSuggestedPost?: boolean;
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
  deleteChatUser: {
    chatId: string;
    userId: string;
    shouldRevokeHistory?: boolean;
  } & WithTabId;
  deleteChat: { chatId: string } & WithTabId;

  // chat creation
  createChannel: {
    title: string;
    about?: string;
    photo?: File;
    memberIds?: string[];
    discussionChannelId?: string;
  } & (
    { isChannel: true } | { isSuperGroup: true }
  ) & WithTabId;
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
    directInfo?: {
      formId: string;
      inputInvoice: ApiInputInvoice;
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

  processMonetizationRevenueWithdrawalUrl: {
    peerId: string;
    currentPassword: string;
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
  hidePeerSettingsBar: {
    peerId: string;
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
    quoteOffset?: number;
    scrollTargetPosition?: ScrollTargetPosition;
    timestamp?: number;
  } & WithTabId;
  scrollMessageListToBottom: WithTabId | undefined;

  updateDraftReplyInfo: Partial<ApiInputMessageReplyInfo> & WithTabId;
  resetDraftReplyInfo: WithTabId | undefined;
  updateDraftSuggestedPostInfo: Partial<ApiInputSuggestedPostInfo> & WithTabId;
  resetDraftSuggestedPostInfo: WithTabId | undefined;
  initDraftFromSuggestedMessage: {
    chatId: string;
    messageId: number;
  } & WithTabId;
  updateInsertingPeerIdMention: {
    peerId?: string;
  } & WithTabId;

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
  openFrozenAccountModal: WithTabId | undefined;
  closeFrozenAccountModal: WithTabId | undefined;
  openDeleteAccountModal: {
    days: number;
  } & WithTabId | undefined;
  closeDeleteAccountModal: WithTabId | undefined;
  openAgeVerificationModal: WithTabId | undefined;
  closeAgeVerificationModal: WithTabId | undefined;
  setAccountTTL: {
    days: number;
  } & WithTabId | undefined;
  loadAccountDaysTtl: undefined;

  // Chats
  loadPeerSettings: {
    peerId: string;
  };
  fetchChat: {
    chatId: string;
  };
  loadChannelRecommendations: {
    chatId?: string;
  };
  loadBotRecommendations: {
    userId: string;
  };
  toggleChannelRecommendations: {
    chatId: string;
  };
  updateChatMutedState: {
    chatId: string;
    mutedUntil: number;
  };
  updateChatSilentPosting: {
    chatId: string;
    isEnabled: boolean;
  };
  updatePaidMessagesPrice: {
    chatId: string;
    paidMessagesStars: number;
  } & WithTabId;
  toggleAutoTranslation: {
    chatId: string;
    isEnabled: boolean;
  } & WithTabId;
  setMainProfileTab: {
    chatId: string;
    tab: ApiProfileTab;
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
    threadId?: never;
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
  openPrivateChannel: {
    id: string;
    threadId?: ThreadId;
    messageId?: number;
    commentId?: number;
    timestamp?: number;
    linkContext?: LinkContext;
  } & WithTabId;
  loadFullChat: {
    chatId: string;
    withPhotos?: boolean;
    force?: boolean;
  };
  invalidateFullInfo: {
    peerId: string;
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
  changeProfileTab: {
    profileTab: ProfileTabType | undefined;
    shouldScrollTo?: boolean;
  } & WithTabId;

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
    isTon?: boolean;
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
    currency?: ApiTypeCurrencyAmount['currency'];
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
  readAllReactions: {
    chatId: string;
    threadId?: ThreadId;
  };
  readAllMentions: {
    chatId: string;
    threadId?: ThreadId;
  };
  markMentionsRead: {
    chatId: string;
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
  toggleTodoCompleted: {
    chatId: string;
    messageId: number;
    completedIds: number[];
    incompletedIds: number[];
  };
  appendTodoList: {
    chatId: string;
    items: ApiTodoItem[];
    messageId: number;
  } & WithTabId;
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
    peerId?: string;
    isPrivate?: boolean;
    shouldIgnoreDefaultPrivacy?: boolean;
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
  };
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
  openUniqueGiftBySlug: {
    slug: string;
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
    peerId: string;
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
  loadStoryAlbums: {
    peerId: string;
  };
  selectStoryAlbum: {
    peerId: string;
    albumId?: number;
  } & WithTabId;
  loadAlbumStories: {
    peerId: string;
    albumId: number;
    offsetId?: number;
  };
  resetSelectedStoryAlbum: WithTabId | undefined;

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
    timestamp?: number;
  } & WithTabId;
  closeMediaViewer: WithTabId | undefined;
  updateLastPlaybackTimestamp: {
    chatId: string;
    messageId: number;
    timestamp?: number;
  };
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
  openMediaFromTimestamp: {
    chatId: string;
    messageId: number;
    threadId?: ThreadId;
    timestamp: number;
  } & WithTabId;
  openAudioPlayer: {
    chatId: string;
    threadId?: ThreadId;
    messageId: number;
    origin?: AudioOrigin;
    volume?: number;
    playbackRate?: number;
    isMuted?: boolean;
    timestamp?: number;
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
  } & WithTabId;
  startBotFatherConversation: {
    param: string;
  } & WithTabId;
  loadBotFreezeAppeal: undefined;
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
    shouldSharePhoneNumber?: boolean;
    note?: ApiFormattedText;
  } & WithTabId;
  updateContactNote: {
    userId: string;
    note: ApiFormattedText;
  } & WithTabId;
  toggleNoPaidMessagesException: {
    userId: string;
    shouldRefundCharged: boolean;
  };
  openChatRefundModal: {
    userId: string;
  } & WithTabId;
  closeChatRefundModal: WithTabId | undefined;
  openProfileRatingModal: {
    userId: string;
    level: number;
  } & WithTabId;
  closeProfileRatingModal: WithTabId | undefined;
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
    quoteOffset?: number;
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
  loadUserCollectibleStatuses: undefined;
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
    chatId: string;
    threadId: ThreadId;
    isSilent?: boolean;
    scheduledAt?: number;
    paidMessagesStars?: number;
  } & WithTabId;
  sendInlineBotApiResult: {
    chat: ApiChat;
    id: string;
    queryId: string;
    replyInfo?: ApiInputMessageReplyInfo;
    sendAs?: ApiPeer;
    isSilent?: boolean;
    scheduledAt?: number;
    allowPaidStars?: number;
  };
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
    threadId?: ThreadId;
    button: ApiKeyboardButton;
  } & WithTabId;
  clickSuggestedMessageButton: {
    chatId: string;
    messageId: number;
    button: ApiKeyboardButtonSuggestedMessage;
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
  updateMiniAppCachedPosition: {
    position: Point;
  };
  updateMiniAppCachedSize: {
    size: Size;
  };
  // Misc
  refreshLangPackFromCache: {
    langCode: string;
  };
  openPollModal: ({
    isQuiz?: boolean;
  } & WithTabId) | undefined;
  closePollModal: WithTabId | undefined;
  openTodoListModal: {
    chatId: string;
    messageId?: number;
    forNewTask?: boolean;
  } & WithTabId;
  closeTodoListModal: WithTabId | undefined;
  requestConfetti: (ConfettiParams & WithTabId) | WithTabId;
  requestWave: {
    startX: number;
    startY: number;
  } & WithTabId;

  updateAttachmentSettings: {
    defaultAttachmentCompression?: AttachmentCompression;
    shouldCompress?: boolean;
    shouldSendGrouped?: boolean;
    isInvertedMedia?: true;
    webPageMediaSize?: WebPageMediaSize;
    shouldSendInHighQuality?: boolean;
  };
  updateShouldSaveAttachmentsCompression: { shouldSave: boolean } & WithTabId;
  applyDefaultAttachmentsCompression: undefined;

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
  setPaidMessageAutoApprove: undefined;

  updateArchiveSettings: {
    isMinimized?: boolean;
    isHidden?: boolean;
  };

  openUrl: {
    url: string;
    shouldSkipModal?: boolean;
    ignoreDeepLinks?: boolean;
    linkContext?: LinkContext;
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
    messageListType?: MessageListType;
  } & WithTabId;
  dismissNotification: { localId: string } & WithTabId;

  updatePageTitle: WithTabId | undefined;
  closeInviteViaLinkModal: WithTabId | undefined;

  openOneTimeMediaModal: TabState['oneTimeMediaModal'] & WithTabId;
  closeOneTimeMediaModal: WithTabId | undefined;

  requestCollectibleInfo: {
    peerId: string;
    type: 'phone' | 'username';
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
  openLeftColumnContent: {
    contentKey?: LeftColumnContent;
  } & WithTabId;
  openSettingsScreen: {
    screen?: SettingsScreens;
  } & WithTabId;
  requestNextFoldersAction: {
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
    nonContactPeersPaidStars?: number | null;
    shouldDisplayGiftsButton?: boolean;
    disallowedGifts?: ApiDisallowedGiftsSettings;
  };

  // Premium
  openPremiumModal: ({
    initialSection?: ApiPremiumSection;
    fromUserId?: string;
    toUserId?: string;
    isSuccess?: boolean;
    isGift?: boolean;
    monthsAmount?: number;
    gift?: ApiStarGift;
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

  openSuggestMessageModal: {
    chatId: string;
    messageId?: number;
  } & WithTabId;
  closeSuggestMessageModal: WithTabId | undefined;

  openSuggestedPostApprovalModal: {
    chatId: string;
    messageId: number;
  } & WithTabId;
  closeSuggestedPostApprovalModal: WithTabId | undefined;

  openQuickPreview: {
    id: string;
    threadId?: ThreadId;
  } & WithTabId;
  closeQuickPreview: WithTabId | undefined;

  openDeleteMessageModal: ({
    chatId: string;
    messageIds: number[];
    isSchedule?: boolean;
    onConfirm?: NoneToVoidFunction;
  } & WithTabId);
  closeDeleteMessageModal: WithTabId | undefined;

  transcribeAudio: {
    chatId: string;
    messageId: number;
  };

  loadPremiumGifts: undefined;
  loadTonGifts: undefined;
  loadStarGifts: undefined;
  loadMyUniqueGifts: {
    shouldRefresh?: true;
  } | undefined;
  updateResaleGiftsFilter: {
    filter: ResaleGiftsFilterOptions;
  } & WithTabId;
  loadResaleGifts: {
    giftId: string;
    shouldRefresh?: boolean;
  } & WithTabId;
  resetResaleGifts: WithTabId | undefined;
  loadDefaultTopicIcons: undefined;
  loadPremiumStickers: undefined;

  openGiftModal: {
    forUserId: string;
    selectedResaleGift?: ApiStarGift;
  } & WithTabId;
  closeGiftModal: WithTabId | undefined;
  sendStarGift: StarGiftInfo & WithTabId;
  buyStarGift: {
    peerId: string;
    slug: string;
    price: ApiTypeCurrencyAmount;
  } & WithTabId;
  sendPremiumGiftByStars: {
    userId: string;
    months: number;
    amount: number;
    message?: ApiFormattedText;
  } & WithTabId;

  openGiftInfoModalFromMessage: {
    chatId: string;
    messageId: number;
  } & WithTabId;
  openGiftInfoModal: ({
    peerId: string;
    recipientId?: string;
    gift: ApiSavedStarGift;
  } | {
    gift: ApiStarGift;
  }) & WithTabId;
  openLockedGiftModalInfo: {
    untilDate?: number;
    reason?: ApiFormattedText;
  } & WithTabId;
  checkCanSendGift: {
    gift: ApiStarGift;
    onSuccess: () => void;
  } & WithTabId;
  openGiftResalePriceComposerModal: ({
    peerId: string;
    gift: ApiSavedStarGift;
  }) & WithTabId;
  closeGiftInfoModal: WithTabId | undefined;
  closeLockedGiftModal: WithTabId | undefined;
  closeGiftResalePriceComposerModal: WithTabId | undefined;
  openGiftInMarket: {
    gift: ApiStarGift;
  } & WithTabId;
  closeResaleGiftsMarket: WithTabId | undefined;

  openGiftUpgradeModal: {
    giftId: string;
    peerId?: string;
    gift?: ApiSavedStarGift;
  } & WithTabId;
  closeGiftUpgradeModal: WithTabId | undefined;
  upgradeGift: {
    gift: ApiInputSavedStarGift;
    shouldKeepOriginalDetails?: boolean;
    upgradeStars?: number;
  } & WithTabId;
  upgradePrepaidGift: {
    peerId: string;
    hash: string;
    stars: number;
  } & WithTabId;

  openGiftWithdrawModal: {
    gift: ApiSavedStarGift;
  } & WithTabId;
  clearGiftWithdrawError: WithTabId | undefined;
  closeGiftWithdrawModal: WithTabId | undefined;
  openGiftStatusInfoModal: {
    emojiStatus: ApiEmojiStatusCollectible;
  } & WithTabId;
  closeGiftStatusInfoModal: WithTabId | undefined;
  openGiftInfoValueModal: {
    gift: ApiStarGiftUnique;
  } & WithTabId;
  closeGiftInfoValueModal: WithTabId | undefined;
  processStarGiftWithdrawal: {
    gift: ApiInputSavedStarGift;
    password: string;
  } & WithTabId;

  openGiftTransferModal: {
    gift: ApiSavedStarGift;
  } & WithTabId;
  transferGift: {
    gift: ApiInputSavedStarGift;
    transferStars?: number;
    recipientId: string;
  } & WithTabId;
  removeGiftDescription: {
    gift: ApiInputSavedStarGift;
    price: number;
  } & WithTabId;
  closeGiftTransferModal: WithTabId | undefined;
  openGiftTransferConfirmModal: {
    gift: ApiSavedStarGift;
    recipientId: string;
  } & WithTabId;
  closeGiftTransferConfirmModal: WithTabId | undefined;
  openGiftDescriptionRemoveModal: {
    gift: ApiSavedStarGift;
    price: number;
    details: ApiStarGiftAttributeOriginalDetails;
  } & WithTabId;
  closeGiftDescriptionRemoveModal: WithTabId | undefined;
  updateSelectedGiftCollection: {
    peerId: string;
    collectionId: number;
  } & WithTabId;
  resetSelectedGiftCollection: {
    peerId: string;
  } & WithTabId;

  loadPeerSavedGifts: {
    peerId: string;
    shouldRefresh?: boolean;
  } & WithTabId;
  reloadPeerSavedGifts: {
    peerId: string;
  };
  changeGiftVisibility: {
    gift: ApiInputSavedStarGift;
    shouldUnsave?: boolean;
  } & WithTabId;
  convertGiftToStars: {
    gift: ApiInputSavedStarGift;
  } & WithTabId;
  toggleSavedGiftPinned: {
    peerId: string;
    gift: ApiSavedStarGift;
  } & WithTabId;

  updateStarGiftPrice: {
    gift: ApiInputSavedStarGift;
    price: ApiTypeCurrencyAmount;
  } & WithTabId;

  loadStarGiftCollections: {
    peerId: string;
    hash?: string;
  } & WithTabId;

  openStarsGiftModal: ({
    chatId?: string;
    forUserId?: string;
  } & WithTabId) | undefined;
  closeStarsGiftModal: WithTabId | undefined;

  setEmojiStatus: {
    emojiStatus: ApiEmojiStatusType;
    referrerWebAppKey?: string;
  } & WithTabId;
  openSuggestedStatusModal: {
    botId: string;
    webAppKey?: string;
    customEmojiId: string;
    duration?: number;
  } & WithTabId;
  closeSuggestedStatusModal: WithTabId | undefined;

  updateGiftProfileFilter: {
    peerId: string;
    filter: Partial<GiftProfileFilterOptions>;
  } & WithTabId;
  resetGiftProfileFilter: {
    peerId: string;
  } & WithTabId;

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

  openPaymentMessageConfirmDialogOpen: WithTabId | undefined;
  closePaymentMessageConfirmDialogOpen: WithTabId | undefined;
  openPriceConfirmModal: {
    originalAmount: number;
    newAmount: number;
    currency: 'TON' | 'XTR';
    directInfo: {
      formId: string;
      inputInvoice: ApiInputInvoice;
    };
  } & WithTabId;
  closePriceConfirmModal: WithTabId | undefined;

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
    mutedUntil: number;
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

  openEmojiStatusAccessModal: {
    bot?: ApiUser;
    webAppKey?: string;
  } & WithTabId;
  closeEmojiStatusAccessModal: WithTabId | undefined;

  openLocationAccessModal: {
    bot?: ApiUser;
    webAppKey?: string;
  } & WithTabId;
  closeLocationAccessModal: WithTabId | undefined;

  toggleUserEmojiStatusPermission: {
    botId: string;
    isEnabled: boolean;
    isBotAccessEmojiGranted?: boolean;
  };

  toggleUserLocationPermission: {
    botId: string;
    isAccessGranted: boolean;
  };

  reportMessageDelivery: {
    chatId: string;
    messageId: number;
  };
}

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
