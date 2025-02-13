import type { PerformanceType } from '../types';
import type { GlobalState, TabState } from './types';
import { NewChatMembersProgress } from '../types';

import {
  ANIMATION_LEVEL_DEFAULT,
  DARK_THEME_PATTERN_COLOR,
  DEFAULT_GIFT_PROFILE_FILTER_OPTIONS,
  DEFAULT_MESSAGE_TEXT_SIZE_PX,
  DEFAULT_PATTERN_COLOR,
  DEFAULT_PLAYBACK_RATE,
  DEFAULT_VOLUME,
  IOS_DEFAULT_MESSAGE_TEXT_SIZE_PX,
  MACOS_DEFAULT_MESSAGE_TEXT_SIZE_PX,
} from '../config';
import { IS_IOS, IS_MAC_OS } from '../util/windowEnvironment';

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

export const INITIAL_PERFORMANCE_STATE_MID: PerformanceType = {
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
  stickerEffects: false,
  storyRibbonAnimations: false,
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

export const INITIAL_GLOBAL_STATE: GlobalState = {
  isInited: true,
  attachMenu: { bots: {} },
  passcode: {},
  twoFaSettings: {},
  isAppUpdateAvailable: false,
  isElectronUpdateAvailable: false,
  shouldShowContextMenuHint: true,

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
  },

  stories: {
    byPeerId: {},
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
    shouldSendGrouped: true,
    isInvertedMedia: undefined,
    webPageMediaSize: undefined,
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
      theme: 'light',
      shouldUseSystemTheme: true,
      messageTextSize: IS_IOS
        ? IOS_DEFAULT_MESSAGE_TEXT_SIZE_PX
        : (IS_MAC_OS ? MACOS_DEFAULT_MESSAGE_TEXT_SIZE_PX : DEFAULT_MESSAGE_TEXT_SIZE_PX),
      animationLevel: ANIMATION_LEVEL_DEFAULT,
      messageSendKeyCombo: 'enter',
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
      shouldSkipWebAppCloseConfirmation: false,
      shouldUpdateStickerSetOrder: true,
      language: 'en',
      timeFormat: '24h',
      wasTimeFormatSetManually: false,
      isConnectionStatusMinimized: true,
      shouldArchiveAndMuteNewNonContact: false,
      shouldNewNonContactPeersRequirePremium: false,
      shouldHideReadMarks: false,
      canTranslate: false,
      canTranslateChats: true,
      doNotTranslate: [],
      canDisplayChatInTitle: true,
      shouldAllowHttpTransport: true,
      shouldWarnAboutSvg: true,
    },
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
    performance: INITIAL_PERFORMANCE_STATE_MAX,
    privacy: {},
    notifyExceptions: {},
    botVerificationShownPeerIds: [],
  },

  serviceNotifications: [],
  trustedBotIds: [],

  transcriptions: {},
  translations: {
    byChatId: {},
  },

  byTabId: {},

  archiveSettings: {
    isMinimized: false,
    isHidden: false,
  },
};

export const INITIAL_TAB_STATE: TabState = {
  id: 0,
  isMasterTab: false,
  isLeftColumnShown: true,
  isChatInfoShown: false,
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

  savedGifts: {
    filter: {
      ...DEFAULT_GIFT_PROFILE_FILTER_OPTIONS,
    },
    giftsByPeerId: {},
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
};
