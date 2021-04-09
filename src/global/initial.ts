import { GlobalState } from './types';

import { ANIMATION_LEVEL_DEFAULT, DEFAULT_MESSAGE_TEXT_SIZE_PX } from '../config';

export const INITIAL_STATE: GlobalState = {
  isLeftColumnShown: true,
  isChatInfoShown: false,
  uiReadyState: 0,

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
      isBackgroundBlurred: true,
      animationLevel: ANIMATION_LEVEL_DEFAULT,
      messageSendKeyCombo: 'enter',
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
    privacy: {},
  },

  twoFaSettings: {},
};
