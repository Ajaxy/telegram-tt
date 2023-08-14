import type { TabState, GlobalState } from './types';
import type { PerformanceType } from '../types';
import { NewChatMembersProgress } from '../types';

import {
  ANIMATION_LEVEL_DEFAULT,
  DARK_THEME_PATTERN_COLOR,
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
};

export const INITIAL_GLOBAL_STATE: GlobalState = {
  attachMenu: { bots: {} },
  passcode: {},
  twoFaSettings: {},
  isUpdateAvailable: false,
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
  },

  chats: {
    listIds: {},
    isFullyLoaded: {},
    orderedPinnedIds: {},
    totalCount: {},
    byId: {},
    fullInfoById: {},
  },

  messages: {
    byChatId: {},
    sponsoredByChatId: {},
  },

  stories: {
    byUserId: {},
    orderedUserIds: {
      archived: [],
      active: [],
    },
    hasNext: true,
    hasNextInArchive: true,
  },

  groupCalls: {
    byId: {},
  },

  attachmentSettings: {
    shouldCompress: true,
    shouldSendGrouped: true,
  },

  scheduledMessages: {
    byChatId: {},
  },

  chatFolders: {
    byId: {},
    invites: {},
  },

  fileUploads: {
    byMessageLocalId: {},
  },

  recentEmojis: ['grinning', 'kissing_heart', 'christmas_tree', 'brain', 'trophy', 'duck', 'cherries'],
  recentCustomEmojis: ['5377305978079288312'],
  topReactions: [],
  recentReactions: [],

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
    premiumSet: {
      stickers: [],
    },
    featured: {
      setIds: [],
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
      shouldUpdateStickerSetOrder: true,
      language: 'en',
      timeFormat: '24h',
      wasTimeFormatSetManually: false,
      isConnectionStatusMinimized: true,
      shouldArchiveAndMuteNewNonContact: false,
      canTranslate: false,
      canTranslateChats: true,
      doNotTranslate: [],
      canDisplayChatInTitle: true,
      shouldAllowHttpTransport: true,
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

  globalSearch: {},

  userSearch: {},

  localTextSearch: {
    byChatThreadKey: {},
  },

  localMediaSearch: {
    byChatThreadKey: {},
  },

  management: {
    byChatId: {},
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

  forwardMessages: {},

  pollResults: {},

  payment: {},

  notifications: [],

  dialogs: [],

  activeReactions: {},

  activeDownloads: {
    byChatId: {},
  },

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
