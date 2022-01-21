import {
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
  AudioOrigin,
} from '../types';

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
  x: number;
  y: number;
  messageId?: number;
  endX?: number;
  endY?: number;
  startSize?: number;
  reaction?: string;
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
}

export type GlobalState = {
  appConfig?: ApiAppConfig;
  isChatInfoShown: boolean;
  isLeftColumnShown: boolean;
  isPollModalOpen?: boolean;
  newChatMembersProgress?: NewChatMembersProgress;
  uiReadyState: 0 | 1 | 2;
  shouldSkipHistoryAnimations?: boolean;
  connectionState?: ApiUpdateConnectionStateType;
  currentUserId?: string;
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
    // TODO Remove
    selectedId?: string;
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
    isGroupCallPanelHidden?: boolean;
    isFallbackConfirmOpen?: boolean;
    fallbackChatId?: string;
    fallbackUserIdsToRemove?: string[];
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

  animatedEmojis?: ApiStickerSet;
  animatedEmojiEffects?: ApiStickerSet;
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
  activeEmojiInteraction?: ActiveEmojiInteraction;
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
    byChatId: Record<string, {
      isActive: boolean;
      isUsernameAvailable?: boolean;
      error?: string;
    }>;
  };

  mediaViewer: {
    chatId?: string;
    threadId?: number;
    messageId?: number;
    avatarOwnerId?: string;
    profilePhotoIndex?: number;
    origin?: MediaViewerOrigin;
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
  };

  pollResults: {
    chatId?: string;
    messageId?: number;
    voters?: Record<string, string[]>; // TODO Rename to `voterIds`
    offsets?: Record<string, string>;
  };

  payment: {
    chatId?: string;
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
    providerId?: string;
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

  activeDownloads: {
    byChatId: Record<string, number[]>;
  };

  shouldShowContextMenuHint?: boolean;

  serviceNotifications: ServiceNotification[];
};

export type ActionTypes = (
  // system
  'init' | 'reset' | 'disconnect' | 'initApi' | 'apiUpdate' | 'sync' | 'saveSession' | 'afterSync' |
  'showNotification' | 'dismissNotification' | 'showDialog' | 'dismissDialog' |
  // ui
  'toggleChatInfo' | 'setIsUiReady' | 'addRecentEmoji' | 'addRecentSticker' | 'toggleLeftColumn' |
  'toggleSafeLinkModal' | 'openHistoryCalendar' | 'closeHistoryCalendar' | 'disableContextMenuHint' |
  'setNewChatMembersDialogState' | 'disableHistoryAnimations' | 'setLeftColumnWidth' | 'resetLeftColumnWidth' |
  'openSeenByModal' | 'closeSeenByModal' | 'closeReactorListModal' |
  'openReactorListModal' |
  // auth
  'setAuthPhoneNumber' | 'setAuthCode' | 'setAuthPassword' | 'signUp' | 'returnToAuthPhoneNumber' | 'signOut' |
  'setAuthRememberMe' | 'clearAuthError' | 'uploadProfilePhoto' | 'goToAuthQrCode' | 'clearCache' |
  // chats
  'preloadTopChatMessages' | 'preloadArchivedChats' | 'loadChats' | 'loadMoreChats' | 'openChat' |
  'openChatWithInfo' | 'openLinkedChat' |
  'openSupportChat' | 'openTipsChat' | 'focusMessageInComments' |
  'loadFullChat' | 'loadTopChats' | 'requestChatUpdate' | 'updateChatMutedState' |
  'joinChannel' | 'leaveChannel' | 'deleteChannel' | 'toggleChatPinned' | 'toggleChatArchived' | 'toggleChatUnread' |
  'loadChatFolders' | 'loadRecommendedChatFolders' | 'editChatFolder' | 'addChatFolder' | 'deleteChatFolder' |
  'updateChat' | 'toggleSignatures' | 'loadGroupsForDiscussion' | 'linkDiscussionGroup' | 'unlinkDiscussionGroup' |
  'loadProfilePhotos' | 'loadMoreMembers' | 'setActiveChatFolder' | 'openNextChat' | 'setChatEnabledReactions' |
  'addChatMembers' | 'deleteChatMember' | 'openPreviousChat' | 'editChatFolders' | 'toggleIsProtected' |
  // messages
  'loadViewportMessages' | 'selectMessage' | 'sendMessage' | 'cancelSendingMessage' | 'pinMessage' | 'deleteMessages' |
  'markMessageListRead' | 'markMessagesRead' | 'loadMessage' | 'focusMessage' | 'focusLastMessage' | 'sendPollVote' |
  'editMessage' | 'deleteHistory' | 'enterMessageSelectMode' | 'toggleMessageSelection' | 'exitMessageSelectMode' |
  'openTelegramLink' | 'openChatByUsername' | 'requestThreadInfoUpdate' | 'setScrollOffset' | 'unpinAllMessages' |
  'setReplyingToId' | 'setEditingId' | 'editLastMessage' | 'saveDraft' | 'clearDraft' | 'loadPinnedMessages' |
  'toggleMessageWebPage' | 'replyToNextMessage' | 'deleteChatUser' | 'deleteChat' | 'sendReaction' |
  'reportMessages' | 'sendMessageAction' | 'focusNextReply' | 'openChatByInvite' | 'loadSeenBy' |
  'loadSponsoredMessages' | 'viewSponsoredMessage' | 'loadSendAs' | 'saveDefaultSendAs' | 'loadAvailableReactions' |
  'stopActiveEmojiInteraction' | 'interactWithAnimatedEmoji' | 'loadReactors' | 'setDefaultReaction' |
  'sendDefaultReaction' | 'sendEmojiInteraction' | 'sendWatchingEmojiInteraction' | 'loadMessageReactions' |
  'stopActiveReaction' |
  // downloads
  'downloadSelectedMessages' | 'downloadMessageMedia' | 'cancelMessageMediaDownload' |
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
  'loadFullUser' | 'openUserInfo' | 'loadNearestCountry' | 'loadTopUsers' | 'loadContactList' |
  'loadCurrentUser' | 'updateProfile' | 'checkUsername' | 'addContact' | 'updateContact' |
  'deleteContact' | 'loadUser' | 'setUserSearchQuery' | 'loadCommonChats' |
  // chat creation
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
  'loadCountryList' | 'ensureTimeFormat' | 'loadAppConfig' |
  // stickers & GIFs
  'loadStickerSets' | 'loadAddedStickers' | 'loadRecentStickers' | 'loadFavoriteStickers' | 'loadFeaturedStickers' |
  'loadStickers' | 'setStickerSearchQuery' | 'loadSavedGifs' | 'setGifSearchQuery' | 'searchMoreGifs' |
  'faveSticker' | 'unfaveSticker' | 'toggleStickerSet' | 'loadAnimatedEmojis' |
  'loadStickersForEmoji' | 'clearStickersForEmoji' | 'loadEmojiKeywords' | 'loadGreetingStickers' |
  'openStickerSetShortName' |
  // bots
  'clickInlineButton' | 'sendBotCommand' | 'loadTopInlineBots' | 'queryInlineBot' | 'sendInlineBotResult' |
  'resetInlineBot' | 'restartBot' | 'startBot' |
  // media viewer & audio player
  'openMediaViewer' | 'closeMediaViewer' |
  'openAudioPlayer' | 'setAudioPlayerVolume' | 'setAudioPlayerPlaybackRate' |
  'setAudioPlayerMuted' | 'setAudioPlayerOrigin' | 'closeAudioPlayer' |
  // misc
  'openPollModal' | 'closePollModal' |
  'loadWebPagePreview' | 'clearWebPagePreview' | 'loadWallpapers' | 'uploadWallpaper' |
  'setDeviceToken' | 'deleteDeviceToken' |
  'checkVersionNotification' | 'createServiceNotification' |
  // payment
  'openPaymentModal' | 'closePaymentModal' | 'addPaymentError' |
  'validateRequestedInfo' | 'setPaymentStep' | 'sendPaymentForm' | 'getPaymentForm' | 'getReceipt' |
  'sendCredentialsInfo' | 'setInvoiceMessageInfo' | 'clearPaymentError' | 'clearReceipt' |
  // calls
  'joinGroupCall' | 'toggleGroupCallMute' | 'toggleGroupCallPresentation' | 'leaveGroupCall' |
  'toggleGroupCallVideo' | 'requestToSpeak' | 'setGroupCallParticipantVolume' | 'toggleGroupCallPanel' |
  'createGroupCall' | 'joinVoiceChatByLink' | 'subscribeToGroupCallUpdates' | 'createGroupCallInviteLink' |
  'loadMoreGroupCallParticipants' | 'connectToActiveGroupCall' | 'playGroupCallSound' |
  'openCallFallbackConfirm' | 'closeCallFallbackConfirm' | 'inviteToCallFallback'
);

export interface DispatchOptions {
  forceOnHeavyAnimation?: boolean;
  // Workaround for iOS gesture history navigation
  forceSyncOnIOs?: boolean;
}

export type GlobalActions = Record<ActionTypes, (payload?: any, options?: DispatchOptions) => void>;
