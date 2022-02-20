export const APP_NAME = process.env.APP_NAME || 'Telegram WebZ';
export const APP_VERSION = process.env.APP_VERSION!;
export const APP_REVISION = process.env.APP_REVISION;

export const DEBUG = (
  process.env.APP_ENV !== 'production' && process.env.APP_ENV !== 'perf' && process.env.APP_ENV !== 'test'
);
export const DEBUG_MORE = false;

export const IS_TEST = process.env.APP_ENV === 'test';
export const IS_PERF = process.env.APP_ENV === 'perf';

export const DEBUG_ALERT_MSG = 'Shoot!\nSomething went wrong, please see the error details in Dev Tools Console.';
export const DEBUG_GRAMJS = false;

export const PAGE_TITLE = 'Telegram';
export const INACTIVE_MARKER = ' [Inactive]';

export const SESSION_USER_KEY = 'user_auth';
export const LEGACY_SESSION_KEY = 'GramJs:sessionId';

export const GLOBAL_STATE_CACHE_DISABLED = false;
export const GLOBAL_STATE_CACHE_KEY = 'tt-global-state';
export const GLOBAL_STATE_CACHE_USER_LIST_LIMIT = 500;
export const GLOBAL_STATE_CACHE_CHAT_LIST_LIMIT = 200;
export const GLOBAL_STATE_CACHE_CHATS_WITH_MESSAGES_LIMIT = 30;

export const MEDIA_CACHE_DISABLED = false;
export const MEDIA_CACHE_NAME = 'tt-media';
export const MEDIA_CACHE_NAME_AVATARS = 'tt-media-avatars';
export const MEDIA_PROGRESSIVE_CACHE_DISABLED = false;
export const MEDIA_PROGRESSIVE_CACHE_NAME = 'tt-media-progressive';
export const MEDIA_CACHE_MAX_BYTES = 512 * 1024; // 512 KB
export const CUSTOM_BG_CACHE_NAME = 'tt-custom-bg';
export const LANG_CACHE_NAME = 'tt-lang-packs-v7';
export const ASSET_CACHE_NAME = 'tt-assets';
export const AUTODOWNLOAD_FILESIZE_MB_LIMITS = [1, 5, 10, 50, 100, 500];

export const DOWNLOAD_WORKERS = 16;
export const UPLOAD_WORKERS = 16;

const isBigScreen = typeof window !== 'undefined' && window.innerHeight >= 900;

export const MIN_PASSWORD_LENGTH = 1;

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
export const COMMON_CHATS_LIMIT = 100;
export const GROUP_CALL_PARTICIPANTS_LIMIT = 100;
export const REACTION_LIST_LIMIT = 100;

export const TOP_CHAT_MESSAGES_PRELOAD_LIMIT = 20;

export const SPONSORED_MESSAGE_CACHE_MS = 300000; // 5 min

export const DEFAULT_VOLUME = 1;
export const DEFAULT_PLAYBACK_RATE = 1;

export const ANIMATION_LEVEL_MIN = 0;
export const ANIMATION_LEVEL_MED = 1;
export const ANIMATION_LEVEL_MAX = 2;
export const ANIMATION_LEVEL_DEFAULT = ANIMATION_LEVEL_MAX;

export const DEFAULT_MESSAGE_TEXT_SIZE_PX = 16;
export const IOS_DEFAULT_MESSAGE_TEXT_SIZE_PX = 17;
export const MACOS_DEFAULT_MESSAGE_TEXT_SIZE_PX = 15;

export const DRAFT_DEBOUNCE = 10000; // 10s
export const SEND_MESSAGE_ACTION_INTERVAL = 3000; // 3s

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
export const TMP_CHAT_ID = '0';

export const ANIMATION_END_DELAY = 100;

export const FAST_SMOOTH_MAX_DISTANCE = 1500;
export const FAST_SMOOTH_MIN_DURATION = 250;
export const FAST_SMOOTH_MAX_DURATION = 600;
export const FAST_SMOOTH_SHORT_TRANSITION_MAX_DISTANCE = 500; // px

// Average duration of message sending animation
export const API_UPDATE_THROTTLE = Math.round((FAST_SMOOTH_MIN_DURATION + FAST_SMOOTH_MAX_DURATION) / 2);
export const API_THROTTLE_RESET_UPDATES = new Set([
  'newMessage', 'newScheduledMessage', 'deleteMessages', 'deleteScheduledMessages', 'deleteHistory',
]);

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
export const STICKER_SIZE_FOLDER_SETTINGS = 100;
export const STICKER_SIZE_INLINE_BOT_RESULT = 100;
export const STICKER_SIZE_JOIN_REQUESTS = 140;
export const STICKER_SIZE_INVITES = 140;
export const RECENT_STICKERS_LIMIT = 20;
export const NO_STICKER_SET_ID = 'NO_STICKER_SET';

export const BASE_EMOJI_KEYWORD_LANG = 'en';

export const MENU_TRANSITION_DURATION = 200;
export const SLIDE_TRANSITION_DURATION = 450;

export const VIDEO_MOV_TYPE = 'video/quicktime';
export const VIDEO_WEBM_TYPE = 'video/webm';

export const SUPPORTED_IMAGE_CONTENT_TYPES = new Set([
  'image/png', 'image/gif', 'image/jpeg',
]);

export const SUPPORTED_VIDEO_CONTENT_TYPES = new Set([
  'video/mp4', // video/quicktime added dynamically in environment.ts
]);

export const CONTENT_TYPES_WITH_PREVIEW = new Set([
  ...SUPPORTED_IMAGE_CONTENT_TYPES,
  ...SUPPORTED_VIDEO_CONTENT_TYPES,
]);

export const CONTENT_NOT_SUPPORTED = 'The message is not supported on this version of Telegram.';

// eslint-disable-next-line max-len
export const RE_LINK_TEMPLATE = '((ftp|https?):\\/\\/)?((www\\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\\.[a-zA-Z0-9()]{1,63})\\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)';
export const RE_MENTION_TEMPLATE = '(@[\\w\\d_-]+)';
export const RE_TG_LINK = /^tg:(\/\/)?([?=&\d\w_-]+)?/gm;
export const RE_TME_LINK = /^(?:https?:\/\/)?(?:t\.me\/)/gm;

// eslint-disable-next-line max-len
export const COUNTRIES_WITH_12H_TIME_FORMAT = new Set(['AU', 'BD', 'CA', 'CO', 'EG', 'HN', 'IE', 'IN', 'JO', 'MX', 'MY', 'NI', 'NZ', 'PH', 'PK', 'SA', 'SV', 'US']);

// MTProto constants
export const SERVICE_NOTIFICATIONS_USER_ID = '777000';
export const REPLIES_USER_ID = '1271266957'; // TODO For Test connection ID must be equal to 708513
export const ALL_FOLDER_ID = 0;
export const ARCHIVED_FOLDER_ID = 1;
export const DELETED_COMMENTS_CHANNEL_ID = '-777';
export const MAX_MEDIA_FILES_FOR_ALBUM = 10;
export const MAX_ACTIVE_PINNED_CHATS = 5;
export const SCHEDULED_WHEN_ONLINE = 0x7FFFFFFE;
export const DEFAULT_LANG_CODE = 'en';
export const DEFAULT_LANG_PACK = 'android';
export const LANG_PACKS = ['android', 'ios', 'tdesktop', 'macos'] as const;
export const TIPS_USERNAME = 'TelegramTips';
export const LOCALIZED_TIPS = ['ar', 'pt-br', 'id', 'it', 'ko', 'ms', 'pl', 'es', 'tr'];
export const FEEDBACK_URL = 'https://bugs.telegram.org/?tag_ids=41&sort=time';
export const LIGHT_THEME_BG_COLOR = '#A2AF8E';
export const DARK_THEME_BG_COLOR = '#0F0F0F';
export const DARK_THEME_PATTERN_COLOR = '#0a0a0a8c';
export const DEFAULT_PATTERN_COLOR = 'rgba(90, 110, 70, 0.6)';

// Group calls
export const GROUP_CALL_VOLUME_MULTIPLIER = 100;
export const GROUP_CALL_DEFAULT_VOLUME = 100 * GROUP_CALL_VOLUME_MULTIPLIER;
export const ENABLE_THUMBNAIL_VIDEO = false;
