import {
  ApiChat,
  ApiMessage,
  ApiThreadInfo,
  ApiUser,
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
  ApiFieldError,
} from '../api/types';
import {
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
  Invoice,
  Receipt,
  ApiPrivacyKey,
  ApiPrivacySettings,
  ThemeKey,
  IThemeSettings,
  NotifyException,
  LangCode,
  EmojiKeywords,
  InlineBotSettings,
  NewChatMembersProgress,
} from '../types';

export type MessageListType = 'thread' | 'pinned' | 'scheduled';

export interface MessageList {
  chatId: number;
  threadId: number;
  type: MessageListType;
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
  draft?: ApiFormattedText;
  noWebPage?: boolean;
  threadInfo?: ApiThreadInfo;
  firstMessageId?: number;
  replyStack?: number[];
}

export type GlobalState = {
  isChatInfoShown: boolean;
  isLeftColumnShown: boolean;
  isPollModalOpen?: boolean;
  newChatMembersProgress?: NewChatMembersProgress;
  uiReadyState: 0 | 1 | 2;
  shouldSkipHistoryAnimations?: boolean;
  connectionState?: ApiUpdateConnectionStateType;
  currentUserId?: number;
  lastSyncTime?: number;
  serverTimeOffset: number;

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

  contactList?: {
    hash: number;
    userIds: number[];
  };

  blocked: {
    ids: number[];
    totalCount: number;
  };

  users: {
    byId: Record<number, ApiUser>;
    // TODO Remove
    selectedId?: number;
  };

  chats: {
    // TODO Replace with `Partial<Record>` to properly handle missing keys
    byId: Record<number, ApiChat>;
    listIds: {
      active?: number[];
      archived?: number[];
    };
    orderedPinnedIds: {
      active?: number[];
      archived?: number[];
    };
    totalCount: {
      all?: number;
      archived?: number;
    };
    isFullyLoaded: {
      active?: boolean;
      archived?: boolean;
    };
    forDiscussionIds?: number[];
  };

  messages: {
    byChatId: Record<number, {
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
  };

  scheduledMessages: {
    byChatId: Record<number, {
      byId: Record<number, ApiMessage>;
      hash: number;
    }>;
  };

  chatFolders: {
    orderedIds?: number[];
    byId: Record<number, ApiChatFolder>;
    recommended?: ApiChatFolder[];
    activeChatFolder: number;
  };

  focusedMessage?: {
    chatId?: number;
    threadId?: number;
    messageId?: number;
    direction?: FocusDirection;
    noHighlight?: boolean;
    isResizingContainer?: boolean;
  };

  selectedMessages?: {
    chatId: number;
    messageIds: number[];
  };

  fileUploads: {
    byMessageLocalId: Record<string, {
      progress: number;
    }>;
  };

  recentEmojis: string[];

  stickers: {
    setsById: Record<string, ApiStickerSet>;
    added: {
      hash?: number;
      setIds?: string[];
    };
    recent: {
      hash?: number;
      stickers: ApiSticker[];
    };
    favorite: {
      hash?: number;
      stickers: ApiSticker[];
    };
    greeting: {
      hash?: number;
      stickers: ApiSticker[];
    };
    featured: {
      hash?: number;
      setIds?: string[];
    };
    search: {
      query?: string;
      resultIds?: string[];
    };
    forEmoji: {
      emoji?: string;
      stickers?: ApiSticker[];
      hash?: number;
    };
  };

  animatedEmojis?: ApiStickerSet;
  emojiKeywords: Partial<Record<LangCode, EmojiKeywords>>;

  gifs: {
    saved: {
      hash?: number;
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
    recentlyFoundChatIds?: number[];
    currentContent?: GlobalSearchContent;
    chatId?: number;
    fetchingStatus?: {
      chats?: boolean;
      messages?: boolean;
    };
    localResults?: {
      chatIds?: number[];
      userIds?: number[];
    };
    globalResults?: {
      chatIds?: number[];
      userIds?: number[];
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
    localUserIds?: number[];
    globalUserIds?: number[];
  };

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
    byChatId: Record<number, {
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
    byChatId: Record<number, {
      isActive: boolean;
      isUsernameAvailable?: boolean;
      error?: string;
    }>;
  };

  mediaViewer: {
    chatId?: number;
    threadId?: number;
    messageId?: number;
    avatarOwnerId?: number;
    profilePhotoIndex?: number;
    origin?: MediaViewerOrigin;
  };

  audioPlayer: {
    chatId?: number;
    messageId?: number;
  };

  topPeers: {
    hash?: number;
    userIds?: number[];
    lastRequestedAt?: number;
  };

  topInlineBots: {
    hash?: number;
    userIds?: number[];
    lastRequestedAt?: number;
  };

  webPagePreview?: ApiWebPage;

  forwardMessages: {
    isModalShown?: boolean;
    fromChatId?: number;
    messageIds?: number[];
    toChatId?: number;
  };

  pollResults: {
    chatId?: number;
    messageId?: number;
    voters?: Record<string, number[]>;
    offsets?: Record<string, string>;
  };

  payment: {
    chatId?: number;
    messageId?: number;
    step?: PaymentStep;
    shippingOptions?: ShippingOption[];
    formId?: string;
    requestId?: string;
    savedInfo?: ApiPaymentSavedInfo;
    canSaveCredentials?: boolean;
    invoice?: Invoice;
    invoiceContent?: {
      title?: string;
      text?: string;
      photoUrl?: string;
      amount?: number;
      currency?: string;
      isTest?: boolean;
    };
    nativeProvider?: string;
    providerId?: number;
    nativeParams?: {
      needCardholderName: boolean;
      needCountry: boolean;
      needZip: boolean;
      publishableKey: string;
    };
    stripeCredentials?: {
      type: string;
      id: string;
    };
    passwordMissing?: boolean;
    savedCredentials?: {
      id: string;
      title: string;
    };
    receipt?: Receipt;
    error?: {
      field?: string;
      message?: string;
      description: string;
    };
    isPaymentModalOpen?: boolean;
  };

  chatCreation?: {
    progress: ChatCreationProgress;
    error?: string;
  };

  profileEdit?: {
    progress: ProfileEditProgress;
    isUsernameAvailable?: boolean;
  };

  notifications: ApiNotification[];
  dialogs: (ApiError | ApiInviteInfo)[];

  // TODO Move to settings
  activeSessions: ApiSession[];

  settings: {
    byKey: ISettings;
    loadedWallpapers?: ApiWallpaper[];
    themes: Partial<Record<ThemeKey, IThemeSettings>>;
    privacy: Partial<Record<ApiPrivacyKey, ApiPrivacySettings>>;
    notifyExceptions?: Record<number, NotifyException>;
  };

  twoFaSettings: {
    hint?: string;
    isLoading?: boolean;
    error?: string;
    waitingEmailCodeLength?: number;
  };

  push?: {
    deviceToken: string;
    subscribedAt: number;
  };

  safeLinkModalUrl?: string;
  historyCalendarSelectedAt?: number;
  openedStickerSetShortName?: string;

  // TODO To be removed in August 2021
  shouldShowContextMenuHint?: boolean;
};

export type ActionTypes = (
  // system
  'init' | 'reset' | 'disconnect' | 'initApi' | 'apiUpdate' | 'sync' | 'saveSession' | 'afterSync' |
  'showNotification' | 'dismissNotification' | 'showDialog' | 'dismissDialog' |
  // ui
  'toggleChatInfo' | 'setIsUiReady' | 'addRecentEmoji' | 'addRecentSticker' | 'toggleLeftColumn' |
  'toggleSafeLinkModal' | 'openHistoryCalendar' | 'closeHistoryCalendar' | 'disableContextMenuHint' |
  'setNewChatMembersDialogState' | 'disableHistoryAnimations' |
  // auth
  'setAuthPhoneNumber' | 'setAuthCode' | 'setAuthPassword' | 'signUp' | 'returnToAuthPhoneNumber' | 'signOut' |
  'setAuthRememberMe' | 'clearAuthError' | 'uploadProfilePhoto' | 'goToAuthQrCode' | 'clearCache' |
  // chats
  'preloadTopChatMessages' | 'loadChats' | 'loadMoreChats' | 'openChat' | 'openChatWithInfo' |
  'openSupportChat' | 'openTipsChat' |
  'loadFullChat' | 'loadTopChats' | 'requestChatUpdate' | 'updateChatMutedState' |
  'joinChannel' | 'leaveChannel' | 'deleteChannel' | 'toggleChatPinned' | 'toggleChatArchived' | 'toggleChatUnread' |
  'loadChatFolders' | 'loadRecommendedChatFolders' | 'editChatFolder' | 'addChatFolder' | 'deleteChatFolder' |
  'updateChat' | 'toggleSignatures' | 'loadGroupsForDiscussion' | 'linkDiscussionGroup' | 'unlinkDiscussionGroup' |
  'loadProfilePhotos' | 'loadMoreMembers' | 'setActiveChatFolder' | 'openNextChat' |
  'addChatMembers' | 'deleteChatMember' | 'openPreviousChat' |
  // messages
  'loadViewportMessages' | 'selectMessage' | 'sendMessage' | 'cancelSendingMessage' | 'pinMessage' | 'deleteMessages' |
  'markMessageListRead' | 'markMessagesRead' | 'loadMessage' | 'focusMessage' | 'focusLastMessage' | 'sendPollVote' |
  'editMessage' | 'deleteHistory' | 'enterMessageSelectMode' | 'toggleMessageSelection' | 'exitMessageSelectMode' |
  'openTelegramLink' | 'openChatByUsername' | 'requestThreadInfoUpdate' | 'setScrollOffset' | 'unpinAllMessages' |
  'setReplyingToId' | 'setEditingId' | 'editLastMessage' | 'saveDraft' | 'clearDraft' | 'loadPinnedMessages' |
  'toggleMessageWebPage' | 'replyToNextMessage' | 'deleteChatUser' | 'deleteChat' |
  'reportMessages' | 'focusNextReply' |
  // scheduled messages
  'loadScheduledHistory' | 'sendScheduledMessages' | 'rescheduleMessage' | 'deleteScheduledMessages' |
  // poll result
  'openPollResults' | 'closePollResults' | 'loadPollOptionResults' |
  // forwarding messages
  'openForwardMenu' | 'exitForwardMode' | 'setForwardChatId' | 'forwardMessages' |
  'openForwardMenuForSelectedMessages' |
  // global search
  'setGlobalSearchQuery' | 'searchMessagesGlobal' | 'addRecentlyFoundChatId' | 'clearRecentlyFoundChats' |
  'setGlobalSearchContent' | 'setGlobalSearchChatId' | 'setGlobalSearchDate' |
  // message search
  'openLocalTextSearch' | 'closeLocalTextSearch' | 'setLocalTextSearchQuery' | 'setLocalMediaSearchType' |
  'searchTextMessagesLocal' | 'searchMediaMessagesLocal' | 'searchMessagesByDate' |
  // management
  'toggleManagement' | 'closeManagement' | 'checkPublicLink' | 'updatePublicLink' | 'updatePrivateLink' |
  // groups
  'togglePreHistoryHidden' | 'updateChatDefaultBannedRights' | 'updateChatMemberBannedRights' | 'updateChatAdmin' |
  'acceptInviteConfirmation' |
  // users
  'loadFullUser' | 'openUserInfo' | 'loadNearestCountry' | 'loadTopUsers' | 'loadContactList' | 'loadCurrentUser' |
  'updateProfile' | 'checkUsername' | 'updateContact' | 'deleteUser' | 'loadUser' | 'setUserSearchQuery' |
  // Channel / groups creation
  'createChannel' | 'createGroupChat' | 'resetChatCreation' |
  // settings
  'setSettingOption' | 'loadPasswordInfo' | 'clearTwoFaError' |
  'updatePassword' | 'updateRecoveryEmail' | 'clearPassword' | 'provideTwoFaEmailCode' | 'checkPassword' |
  'loadBlockedContacts' | 'blockContact' | 'unblockContact' |
  'loadAuthorizations' | 'terminateAuthorization' | 'terminateAllAuthorizations' |
  'loadNotificationSettings' | 'updateContactSignUpNotification' | 'updateNotificationSettings' |
  'updateWebNotificationSettings' | 'loadLanguages' | 'loadPrivacySettings' | 'setPrivacyVisibility' |
  'setPrivacySettings' | 'loadNotificationExceptions' | 'setThemeSettings' | 'updateIsOnline' |
  'loadContentSettings' | 'updateContentSettings' |
  // Stickers & GIFs
  'loadStickerSets' | 'loadAddedStickers' | 'loadRecentStickers' | 'loadFavoriteStickers' | 'loadFeaturedStickers' |
  'loadStickers' | 'setStickerSearchQuery' | 'loadSavedGifs' | 'setGifSearchQuery' | 'searchMoreGifs' |
  'faveSticker' | 'unfaveSticker' | 'toggleStickerSet' | 'loadAnimatedEmojis' |
  'loadStickersForEmoji' | 'clearStickersForEmoji' | 'loadEmojiKeywords' | 'loadGreetingStickers' |
  'openStickerSetShortName' |
  // bots
  'clickInlineButton' | 'sendBotCommand' | 'loadTopInlineBots' | 'queryInlineBot' | 'sendInlineBotResult' |
  'resetInlineBot' | 'restartBot' |
  // misc
  'openMediaViewer' | 'closeMediaViewer' | 'openAudioPlayer' | 'closeAudioPlayer' | 'openPollModal' | 'closePollModal' |
  'loadWebPagePreview' | 'clearWebPagePreview' | 'loadWallpapers' | 'uploadWallpaper' | 'setDeviceToken' |
  'deleteDeviceToken' |
  // payment
  'openPaymentModal' | 'closePaymentModal' | 'addPaymentError' |
  'validateRequestedInfo' | 'setPaymentStep' | 'sendPaymentForm' | 'getPaymentForm' | 'getReceipt' |
  'sendCredentialsInfo' | 'setInvoiceMessageInfo' | 'clearPaymentError' | 'clearReceipt'
);

export type GlobalActions = Record<ActionTypes, (...args: any[]) => void>;
