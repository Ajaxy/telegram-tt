import type { PerformanceType } from '../types';
import type { GlobalState, SharedState, TabState } from './types';
import { LeftColumnContent, NewChatMembersProgress, SettingsScreens } from '../types';

import {
  ANIMATION_LEVEL_DEFAULT,
  DARK_THEME_PATTERN_COLOR,
  DEFAULT_GIFT_PROFILE_FILTER_OPTIONS,
  DEFAULT_MESSAGE_TEXT_SIZE_PX,
  DEFAULT_PATTERN_COLOR,
  DEFAULT_PLAYBACK_RATE,
  DEFAULT_RESALE_GIFTS_FILTER_OPTIONS,
  DEFAULT_VOLUME,
  IOS_DEFAULT_MESSAGE_TEXT_SIZE_PX,
  MACOS_DEFAULT_MESSAGE_TEXT_SIZE_PX,
} from '../config';
import { IS_IOS, IS_MAC_OS } from '../util/browser/windowEnvironment';
import { DEFAULT_APP_CONFIG } from '../limits';

export const INITIAL_PERFORMANCE_STATE_MAX: PerformanceType = {
  animatedEmoji: true,
  autoplayGifs: true,
  autoplayVideos: true,
  contextMenuAnimations: true,
  contextMenuBlur: true,
  loopAnimatedStickers: true,
  mediaViewerAnimations: true,
  messageComposerAnimations: true,
  messageSendingAnimations: true,
  pageTransitions: true,
  reactionEffects: true,
  rightColumnAnimations: true,
  stickerEffects: true,
  storyRibbonAnimations: true,
  snapEffect: true,
};

export const INITIAL_PERFORMANCE_STATE_MED: PerformanceType = {
  animatedEmoji: true,
  autoplayGifs: true,
  autoplayVideos: true,
  contextMenuAnimations: true,
  contextMenuBlur: true,
  loopAnimatedStickers: true,
  mediaViewerAnimations: true,
  messageComposerAnimations: true,
  messageSendingAnimations: true,
  pageTransitions: true,
  reactionEffects: true,
  rightColumnAnimations: false,
  stickerEffects: true,
  storyRibbonAnimations: true,
  snapEffect: false,
};

export const INITIAL_PERFORMANCE_STATE_MIN: PerformanceType = {
  animatedEmoji: false,
  autoplayGifs: false,
  autoplayVideos: false,
  contextMenuAnimations: false,
  contextMenuBlur: false,
  loopAnimatedStickers: false,
  mediaViewerAnimations: false,
  messageComposerAnimations: false,
  messageSendingAnimations: false,
  pageTransitions: false,
  reactionEffects: false,
  rightColumnAnimations: false,
  stickerEffects: false,
  storyRibbonAnimations: false,
  snapEffect: false,
};

export const INITIAL_SHARED_STATE: SharedState = {
  settings: {
    theme: 'light',
    shouldUseSystemTheme: true,
    messageTextSize: IS_IOS
      ? IOS_DEFAULT_MESSAGE_TEXT_SIZE_PX
      : (IS_MAC_OS ? MACOS_DEFAULT_MESSAGE_TEXT_SIZE_PX : DEFAULT_MESSAGE_TEXT_SIZE_PX),
    animationLevel: ANIMATION_LEVEL_DEFAULT,
    messageSendKeyCombo: 'enter',
    performance: INITIAL_PERFORMANCE_STATE_MAX,
    shouldSkipWebAppCloseConfirmation: false,
    language: 'en',
    timeFormat: '24h',
    wasTimeFormatSetManually: false,
    isConnectionStatusMinimized: true,
    canDisplayChatInTitle: true,
    shouldAllowHttpTransport: true,
    shouldWarnAboutFiles: true,
  },
  isInitial: true,
};

export const INITIAL_GLOBAL_STATE: GlobalState = {
  cacheVersion: 2,
  isInited: true,
  attachMenu: { bots: {} },
  passcode: {},
  twoFaSettings: {},
  isAppUpdateAvailable: false,
  shouldShowContextMenuHint: true,
  appConfig: DEFAULT_APP_CONFIG,

  audioPlayer: {
    lastPlaybackRate: DEFAULT_PLAYBACK_RATE,
  },

  mediaViewer: {
    lastPlaybackRate: DEFAULT_PLAYBACK_RATE,
  },

  authRememberMe: true,
  countryList: {
    phoneCodes: [],
    general: [],
  },

  blocked: {
    ids: [],
    totalCount: 0,
  },

  users: {
    byId: {},
    statusesById: {},
    fullInfoById: {},
    previewMediaByBotId: {},
    commonChatsById: {},
    botAppPermissionsById: {},
  },

  peers: {
    profilePhotosById: {},
  },

  chats: {
    listIds: {},
    isFullyLoaded: {},
    orderedPinnedIds: {},
    totalCount: {},
    lastMessageIds: {},
    byId: {},
    fullInfoById: {},
    similarChannelsById: {},
    similarBotsById: {},
    topicsInfoById: {},
    notifyExceptionById: {},
    loadingParameters: {
      active: {},
      archived: {},
      saved: {},
    },
  },

  messages: {
    byChatId: {},
    sponsoredByChatId: {},
    pollById: {},
    webPageById: {},
    playbackByChatId: {},
  },

  stories: {
    byPeerId: {},
    albumsByPeerId: {},
    orderedPeerIds: {
      archived: [],
      active: [],
    },
    hasNext: true,
    hasNextInArchive: true,
    stealthMode: {},
  },

  groupCalls: {
    byId: {},
  },

  attachmentSettings: {
    shouldCompress: true,
    defaultAttachmentCompression: 'compress',
    shouldSendGrouped: true,
    isInvertedMedia: undefined,
    webPageMediaSize: undefined,
    shouldSendInHighQuality: false,
  },

  scheduledMessages: {
    byChatId: {},
  },

  quickReplies: {
    byId: {},
    messagesById: {},
  },

  chatFolders: {
    byId: {},
    invites: {},
    areTagsEnabled: false,
  },

  fileUploads: {
    byMessageKey: {},
  },

  recentEmojis: ['grinning', 'kissing_heart', 'christmas_tree', 'brain', 'trophy', 'duck', 'cherries'],
  recentCustomEmojis: ['5377305978079288312'],

  reactions: {
    defaultTags: [],
    topReactions: [],
    recentReactions: [],
    effectReactions: [],
    hash: {},
  },
  availableEffectById: {},

  stickers: {
    setsById: {},
    added: {},
    recent: {
      stickers: [],
    },
    favorite: {
      stickers: [],
    },
    greeting: {
      stickers: [],
    },
    premium: {
      stickers: [],
    },
    featured: {
      setIds: [],
    },
    effect: {
      stickers: [],
      emojis: [],
    },
    forEmoji: {},
  },

  customEmojis: {
    lastRendered: [],
    byId: {},
    added: {},
    forEmoji: {},
    statusRecent: {},
  },

  emojiKeywords: {},

  gifs: {
    saved: {},
  },

  topPeers: {},

  topInlineBots: {},
  topBotApps: {},

  activeSessions: {
    byHash: {},
    orderedHashes: [],
  },

  activeWebSessions: {
    byHash: {},
    orderedHashes: [],
  },

  settings: {
    byKey: {
      canAutoLoadPhotoFromContacts: true,
      canAutoLoadPhotoInPrivateChats: true,
      canAutoLoadPhotoInGroups: true,
      canAutoLoadPhotoInChannels: true,
      canAutoLoadVideoFromContacts: true,
      canAutoLoadVideoInPrivateChats: true,
      canAutoLoadVideoInGroups: true,
      canAutoLoadVideoInChannels: true,
      canAutoLoadFileFromContacts: false,
      canAutoLoadFileInPrivateChats: false,
      canAutoLoadFileInGroups: false,
      canAutoLoadFileInChannels: false,
      autoLoadFileMaxSizeMb: 10,
      hasWebNotifications: true,
      hasPushNotifications: true,
      notificationSoundVolume: 5,
      shouldSuggestStickers: true,
      shouldSuggestCustomEmoji: true,
      shouldPaidMessageAutoApprove: false,
      shouldUpdateStickerSetOrder: true,
      shouldArchiveAndMuteNewNonContact: false,
      shouldNewNonContactPeersRequirePremium: false,
      disallowedGifts: undefined,
      nonContactPeersPaidStars: 0,
      shouldHideReadMarks: false,
      canTranslate: false,
      canTranslateChats: true,
      doNotTranslate: [],
    },
    privacy: {},
    botVerificationShownPeerIds: [],
    themes: {
      light: {
        isBlurred: true,
        patternColor: DEFAULT_PATTERN_COLOR,
      },
      dark: {
        isBlurred: true,
        patternColor: DARK_THEME_PATTERN_COLOR,
      },
    },
    accountDaysTtl: 365,
  },

  serviceNotifications: [],
  trustedBotIds: [],

  transcriptions: {},
  translations: {
    byChatId: {},
  },

  byTabId: {},
  sharedState: INITIAL_SHARED_STATE,

  archiveSettings: {
    isMinimized: false,
    isHidden: false,
  },
};

export const INITIAL_TAB_STATE: TabState = {
  id: 0,
  isMasterTab: false,
  isLeftColumnShown: true,
  newChatMembersProgress: NewChatMembersProgress.Closed,
  uiReadyState: 0,
  shouldInit: true,

  gifSearch: {},
  stickerSearch: {},

  messageLists: [],
  activeChatFolder: 0,
  tabThreads: {},

  inlineBots: {
    isLoading: false,
    byUsername: {},
  },

  webApps: {
    openedWebApps: {},
    openedOrderedKeys: [],
    sessionKeys: [],
    modalState: 'maximized',
    isModalOpen: false,
    isMoreAppsTabActive: false,
  },

  globalSearch: {},

  userSearch: {},

  leftColumn: {
    contentKey: LeftColumnContent.ChatList,
    settingsScreen: SettingsScreens.Main,
  },

  middleSearch: {
    byChatThreadKey: {},
  },

  sharedMediaSearch: {
    byChatThreadKey: {},
  },

  chatMediaSearch: {
    byChatThreadKey: {},
  },

  management: {
    byChatId: {},
  },

  chatInfo: {
    isOpen: false,
  },

  savedGifts: {
    filter: {
      ...DEFAULT_GIFT_PROFILE_FILTER_OPTIONS,
    },
    collectionsByPeerId: {},
    activeCollectionByPeerId: {},
  },

  resaleGifts: {
    gifts: [],
    count: 0,
    updateIteration: 0,
    filter: {
      ...DEFAULT_RESALE_GIFTS_FILTER_OPTIONS,
    },
  },

  storyViewer: {
    isMuted: true,
    isRibbonShown: false,
  },

  mediaViewer: {
    volume: DEFAULT_VOLUME,
    playbackRate: DEFAULT_PLAYBACK_RATE,
    isMuted: false,
  },

  audioPlayer: {
    volume: DEFAULT_VOLUME,
    playbackRate: DEFAULT_PLAYBACK_RATE,
    isMuted: false,
  },

  isShareMessageModalShown: false,

  isWebAppsCloseConfirmationModalOpen: false,

  forwardMessages: {},

  replyingMessage: {},

  pollResults: {},

  payment: {},
  starsPayment: {},

  notifications: [],

  dialogs: [],

  activeReactions: {},

  activeDownloads: {},

  statistics: {
    byChatId: {},
  },

  pollModal: {
    isOpen: false,
  },

  requestedTranslations: {
    byChatId: {},
  },

  isPaymentMessageConfirmDialogOpen: false,
};
