export const PAGE_TITLE = 'Telegram';
export const INACTIVE_MARKER = ' [Inactive]';

export const APP_NAME = 'Telegram WebZ';
export const APP_VERSION = process.env.APP_VERSION || 'dev';

export const DEBUG = (
  process.env.APP_ENV !== 'production' && process.env.APP_ENV !== 'perf' && process.env.APP_ENV !== 'test'
);
export const DEBUG_MORE = false;

export const IS_TEST = process.env.APP_ENV === 'test';
export const IS_PERF = process.env.APP_ENV === 'perf';

export const DEBUG_ALERT_MSG = 'Shoot!\nSomething went wrong, please see the error details in Dev Tools Console.';
export const DEBUG_GRAMJS = false;

export const GRAMJS_SESSION_ID_KEY = 'GramJs:sessionId';
export const LEGACY_SESSION_KEY = 'user_auth';

export const GLOBAL_STATE_CACHE_DISABLED = false;
export const GLOBAL_STATE_CACHE_KEY = 'tt-global-state';
export const GLOBAL_STATE_CACHE_CHAT_LIST_LIMIT = 30;
export const GLOBAL_STATE_CACHE_USER_LIST_LIMIT = 5000;

export const MEDIA_CACHE_DISABLED = false;
export const MEDIA_CACHE_NAME = 'tt-media';
export const MEDIA_CACHE_NAME_AVATARS = 'tt-media-avatars';
export const MEDIA_PROGRESSIVE_CACHE_DISABLED = false;
export const MEDIA_PROGRESSIVE_CACHE_NAME = 'tt-media-progressive';
export const MEDIA_CACHE_MAX_BYTES = 512 * 1024; // 512 KB
export const CUSTOM_BG_CACHE_NAME = 'tt-custom-bg';
export const LANG_CACHE_NAME = 'tt-lang-packs-v4';
export const ASSET_CACHE_NAME = 'tt-assets';

export const API_UPDATE_THROTTLE = 300;
export const API_THROTTLE_RESET_UPDATES = new Set([
  'newMessage', 'newScheduledMessage', 'deleteMessages', 'deleteScheduledMessages', 'deleteHistory',
]);

export const DOWNLOAD_WORKERS = 16;
export const UPLOAD_WORKERS = 16;

const isBigScreen = typeof window !== 'undefined' && window.innerHeight >= 900;

export const MIN_PASSWORD_LENGTH = 1;

export const MESSAGE_LIST_SENSITIVE_AREA = 750;
export const MESSAGE_LIST_SLICE = isBigScreen ? 60 : 40;
export const MESSAGE_LIST_VIEWPORT_LIMIT = MESSAGE_LIST_SLICE * 2;

export const CHAT_HEIGHT_PX = 72;
export const CHAT_LIST_SLICE = isBigScreen ? 30 : 25;
export const CHAT_LIST_LOAD_SLICE = 100;
export const SHARED_MEDIA_SLICE = 42;
export const MESSAGE_SEARCH_SLICE = 42;
export const GLOBAL_SEARCH_SLICE = 20;
export const MEMBERS_SLICE = 30;
export const MEMBERS_LOAD_SLICE = 200;
export const PINNED_MESSAGES_LIMIT = 50;
export const BLOCKED_LIST_LIMIT = 100;
export const PROFILE_PHOTOS_LIMIT = 40;
export const PROFILE_SENSITIVE_AREA = 500;

export const TOP_CHAT_MESSAGES_PRELOAD_LIMIT = 20;
export const ALL_CHATS_PRELOAD_DISABLED = false;

export const ANIMATION_LEVEL_MIN = 0;
export const ANIMATION_LEVEL_MED = 1;
export const ANIMATION_LEVEL_MAX = 2;
export const ANIMATION_LEVEL_DEFAULT = ANIMATION_LEVEL_MAX;

export const DEFAULT_MESSAGE_TEXT_SIZE_PX = 16;

export const DRAFT_DEBOUNCE = 10000; // 10s

export const EDITABLE_INPUT_ID = 'editable-message-text';
export const EDITABLE_INPUT_MODAL_ID = 'editable-message-text-modal';

// Screen width where Pinned Message / Audio Player in the Middle Header can be safely displayed
export const SAFE_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN = 1440; // px
// Screen width where Pinned Message / Audio Player in the Middle Header shouldn't collapse with ChatInfo
export const SAFE_SCREEN_WIDTH_FOR_CHAT_INFO = 1150; // px

export const MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN = 1275; // px
export const MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN = 925; // px
export const MOBILE_SCREEN_MAX_WIDTH = 600; // px
export const MOBILE_SCREEN_LANDSCAPE_MAX_WIDTH = 950; // px
export const MOBILE_SCREEN_LANDSCAPE_MAX_HEIGHT = 450; // px

export const LOCAL_MESSAGE_ID_BASE = 1e9;

export const ANIMATION_END_DELAY = 100;

export const STICKER_SIZE_INLINE_DESKTOP_FACTOR = 13;
export const STICKER_SIZE_INLINE_MOBILE_FACTOR = 11;
export const STICKER_SIZE_AUTH = 160;
export const STICKER_SIZE_AUTH_MOBILE = 120;
export const STICKER_SIZE_PICKER = 64;
export const STICKER_SIZE_GENERAL_SETTINGS = 48;
export const STICKER_SIZE_PICKER_HEADER = 32;
export const STICKER_SIZE_SEARCH = 64;
export const STICKER_SIZE_MODAL = 64;
export const STICKER_SIZE_TWO_FA = 160;
export const STICKER_SIZE_DISCUSSION_GROUPS = 140;
export const STICKER_SIZE_FOLDER_SETTINGS = 80;
export const MEMOJI_STICKER_ID = 'MEMOJI_STICKER';

export const MENU_TRANSITION_DURATION = 200;
export const SLIDE_TRANSITION_DURATION = 450;
export const LAYERS_TRANSITION_DURATION = 450;

export const CONTENT_TYPES_FOR_QUICK_UPLOAD = 'image/png,image/gif,image/jpeg,video/mp4,video/avi,video/quicktime';

// eslint-disable-next-line max-len
export const RE_LINK_TEMPLATE = '((ftp|https?):\\/\\/)?((www\\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6})\\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)';
export const RE_TME_LINK = /^(?:https?:\/\/)?(?:t\.me\/)([\d\w_]+)(?:\/([\d]+))?$/gm;
export const RE_TME_INVITE_LINK = /^(?:https?:\/\/)?(?:t\.me\/joinchat\/)([\d\w_]+)?$/gm;

// MTProto constants
export const SERVICE_NOTIFICATIONS_USER_ID = 777000;
export const ALL_FOLDER_ID = 0;
export const ARCHIVED_FOLDER_ID = 1;
export const DELETED_COMMENTS_CHANNEL_ID = 777;
export const MAX_MEDIA_FILES_FOR_ALBUM = 10;
export const MAX_ACTIVE_PINNED_CHATS = 5;
export const SCHEDULED_WHEN_ONLINE = 0x7FFFFFFE;
export const DEFAULT_LANG_PACK = 'android';
export const LANG_PACKS = ['android', 'ios', 'tdesktop', 'macos'];
export const TIPS_USERNAME = 'TelegramTips';
export const FEEDBACK_URL = 'https://bugs.telegram.org/?tag_ids=41&sort=time';
export const LIGHT_THEME_BG_COLOR = '#A2AF8E';
export const DARK_THEME_BG_COLOR = '#0F0F0F';
export const DARK_THEME_PATTERN_COLOR = '#0a0a0a8c';
export const DEFAULT_PATTERN_COLOR = 'rgba(90, 110, 70, 0.6)';
