import { GlobalState } from './types';

import {
  ANIMATION_LEVEL_DEFAULT, DARK_THEME_PATTERN_COLOR, DEFAULT_MESSAGE_TEXT_SIZE_PX, DEFAULT_PATTERN_COLOR,
} from '../config';

export const INITIAL_STATE: GlobalState = {
  isLeftColumnShown: true,
  isChatInfoShown: false,
  uiReadyState: 0,
  serverTimeOffset: 0,

  authRememberMe: true,

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

  globalSearch: {},

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

  mediaViewer: {},

  audioPlayer: {},

  forwardMessages: {},

  pollResults: {},

  payment: {},

  notifications: [],

  errors: [],

  activeSessions: [],

  settings: {
    byKey: {
      messageTextSize: DEFAULT_MESSAGE_TEXT_SIZE_PX,
      animationLevel: ANIMATION_LEVEL_DEFAULT,
      messageSendKeyCombo: 'enter',
      theme: 'light',
      shouldAutoDownloadMediaFromContacts: true,
      shouldAutoDownloadMediaInPrivateChats: true,
      shouldAutoDownloadMediaInGroups: true,
      shouldAutoDownloadMediaInChannels: true,
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
};
