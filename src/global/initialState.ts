import type { GlobalState } from './types';
import { NewChatMembersProgress } from '../types';

import {
  ANIMATION_LEVEL_DEFAULT, DARK_THEME_PATTERN_COLOR, DEFAULT_MESSAGE_TEXT_SIZE_PX, DEFAULT_PATTERN_COLOR,
  DEFAULT_PLAYBACK_RATE,
  DEFAULT_VOLUME,
  IOS_DEFAULT_MESSAGE_TEXT_SIZE_PX, MACOS_DEFAULT_MESSAGE_TEXT_SIZE_PX,
} from '../config';
import { IS_IOS, IS_MAC_OS } from '../util/environment';

export const INITIAL_STATE: GlobalState = {
  isLeftColumnShown: true,
  isChatInfoShown: false,
  newChatMembersProgress: NewChatMembersProgress.Closed,
  uiReadyState: 0,
  serverTimeOffset: 0,

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
  },

  chats: {
    listIds: {},
    isFullyLoaded: {},
    orderedPinnedIds: {},
    totalCount: {},
    byId: {},
  },

  messages: {
    byChatId: {},
    messageLists: [],
    sponsoredByChatId: {},
  },

  groupCalls: {
    byId: {},
  },

  scheduledMessages: {
    byChatId: {},
  },

  chatFolders: {
    byId: {},
    activeChatFolder: 0,
  },

  fileUploads: {
    byMessageLocalId: {},
  },

  recentEmojis: ['grinning', 'kissing_heart', 'christmas_tree', 'brain', 'trophy', 'duck', 'cherries'],
  recentCustomEmojis: ['5377305978079288312'],

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
    search: {},
    forEmoji: {},
  },

  customEmojis: {
    lastRendered: [],
    byId: {},
    added: {},
  },

  emojiKeywords: {},

  gifs: {
    saved: {},
    search: {},
  },

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
    byChatId: {},
  },

  management: {
    byChatId: {},
  },

  topPeers: {},

  topInlineBots: {},

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
      canAutoPlayGifs: true,
      canAutoPlayVideos: true,
      shouldSuggestStickers: true,
      shouldLoopStickers: true,
      language: 'en',
      timeFormat: '24h',
      wasTimeFormatSetManually: false,
      isConnectionStatusMinimized: true,
      shouldArchiveAndMuteNewNonContact: false,
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
    privacy: {},
    notifyExceptions: {},
  },

  twoFaSettings: {},
  passcode: {},
  activeReactions: {},

  shouldShowContextMenuHint: true,

  activeDownloads: {
    byChatId: {},
  },

  serviceNotifications: [],

  statistics: {
    byChatId: {},
  },

  pollModal: {
    isOpen: false,
  },

  trustedBotIds: [],

  attachMenu: {
    bots: {},
  },

  transcriptions: {},
};
