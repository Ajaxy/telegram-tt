import { GlobalState } from './types';
import { NewChatMembersProgress } from '../types';

import {
  ANIMATION_LEVEL_DEFAULT, DARK_THEME_PATTERN_COLOR, DEFAULT_MESSAGE_TEXT_SIZE_PX, DEFAULT_PATTERN_COLOR,
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

  recentEmojis: ['grinning', 'kissing_heart', 'christmas_tree', 'brain', 'trophy'],

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
    featured: {
      setIds: [],
    },
    search: {},
    forEmoji: {},
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

  mediaViewer: {},

  audioPlayer: {},

  forwardMessages: {},

  pollResults: {},

  payment: {},

  notifications: [],

  dialogs: [],

  activeSessions: [],

  settings: {
    byKey: {
      theme: 'light',
      shouldUseSystemTheme: true,
      messageTextSize: IS_IOS
        ? IOS_DEFAULT_MESSAGE_TEXT_SIZE_PX
        : (IS_MAC_OS ? MACOS_DEFAULT_MESSAGE_TEXT_SIZE_PX : DEFAULT_MESSAGE_TEXT_SIZE_PX),
      animationLevel: ANIMATION_LEVEL_DEFAULT,
      messageSendKeyCombo: 'enter',
      shouldAutoDownloadMediaFromContacts: true,
      shouldAutoDownloadMediaInPrivateChats: true,
      shouldAutoDownloadMediaInGroups: true,
      shouldAutoDownloadMediaInChannels: true,
      hasWebNotifications: true,
      hasPushNotifications: true,
      notificationSoundVolume: 5,
      shouldAutoPlayGifs: true,
      shouldAutoPlayVideos: true,
      shouldSuggestStickers: true,
      shouldLoopStickers: true,
      language: 'en',
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

  shouldShowContextMenuHint: true,

  activeDownloads: {
    byChatId: {},
  },
};
