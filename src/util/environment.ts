import {
  MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN,
  MOBILE_SCREEN_MAX_WIDTH,
  MOBILE_SCREEN_LANDSCAPE_MAX_HEIGHT,
  MOBILE_SCREEN_LANDSCAPE_MAX_WIDTH,
  IS_TEST,
  SUPPORTED_VIDEO_CONTENT_TYPES,
  VIDEO_MOV_TYPE,
  CONTENT_TYPES_WITH_PREVIEW,
  PRODUCTION_HOSTNAME,
} from '../config';

export * from './environmentWebp';

export * from './environmentSystemTheme';

export function getPlatform() {
  const { userAgent, platform } = window.navigator;
  const macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
  const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
  const iosPlatforms = ['iPhone', 'iPad', 'iPod'];
  let os: 'macOS' | 'iOS' | 'Windows' | 'Android' | 'Linux' | undefined;

  if (iosPlatforms.indexOf(platform) !== -1
    // For new IPads with M1 chip and IPadOS platform returns "MacIntel"
    || (platform === 'MacIntel' && ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 2))) {
    os = 'iOS';
  } else if (macosPlatforms.indexOf(platform) !== -1) {
    os = 'macOS';
  } else if (windowsPlatforms.indexOf(platform) !== -1) {
    os = 'Windows';
  } else if (/Android/.test(userAgent)) {
    os = 'Android';
  } else if (/Linux/.test(platform)) {
    os = 'Linux';
  }

  return os;
}

export const IS_PRODUCTION_HOST = window.location.host === PRODUCTION_HOSTNAME;
export const PLATFORM_ENV = getPlatform();
export const IS_MAC_OS = PLATFORM_ENV === 'macOS';
export const IS_IOS = PLATFORM_ENV === 'iOS';
export const IS_ANDROID = PLATFORM_ENV === 'Android';
export const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
export const IS_PWA = (
  window.matchMedia('(display-mode: standalone)').matches
  || (window.navigator as any).standalone
  || document.referrer.includes('android-app://')
);

export const IS_TOUCH_ENV = window.matchMedia('(pointer: coarse)').matches;
// Keep in mind the landscape orientation
export const IS_SINGLE_COLUMN_LAYOUT = window.innerWidth <= MOBILE_SCREEN_MAX_WIDTH || (
  window.innerWidth <= MOBILE_SCREEN_LANDSCAPE_MAX_WIDTH && window.innerHeight <= MOBILE_SCREEN_LANDSCAPE_MAX_HEIGHT
);
// Special layout, 1 column while chat opened, 2 columns while collapsed
export const IS_TABLET_COLUMN_LAYOUT = !IS_SINGLE_COLUMN_LAYOUT && (
  window.innerWidth <= MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN
);
export const IS_VOICE_RECORDING_SUPPORTED = Boolean(
  window.navigator.mediaDevices && 'getUserMedia' in window.navigator.mediaDevices && (
    window.AudioContext || (window as any).webkitAudioContext
  ),
);
export const IS_SMOOTH_SCROLL_SUPPORTED = 'scrollBehavior' in document.documentElement.style;
export const IS_EMOJI_SUPPORTED = PLATFORM_ENV && (IS_MAC_OS || IS_IOS) && isLastEmojiVersionSupported();
export const IS_SERVICE_WORKER_SUPPORTED = 'serviceWorker' in navigator;
// TODO Consider failed service worker
export const IS_PROGRESSIVE_SUPPORTED = IS_SERVICE_WORKER_SUPPORTED;
export const IS_STREAMING_SUPPORTED = 'MediaSource' in window;
export const IS_OPUS_SUPPORTED = Boolean((new Audio()).canPlayType('audio/ogg; codecs=opus'));
export const IS_CANVAS_FILTER_SUPPORTED = (
  !IS_TEST && 'filter' in (document.createElement('canvas').getContext('2d') || {})
);
export const IS_REQUEST_FULLSCREEN_SUPPORTED = 'requestFullscreen' in document.createElement('div');
export const ARE_CALLS_SUPPORTED = !navigator.userAgent.includes('Firefox');
export const LAYERS_ANIMATION_NAME = IS_ANDROID ? 'slide-fade' : IS_IOS ? 'slide-layers' : 'push-slide';

const TEST_VIDEO = document.createElement('video');
// `canPlayType(VIDEO_MOV_TYPE)` returns false negative at least for macOS Chrome and iOS Safari
export const IS_MOV_SUPPORTED = Boolean(
  TEST_VIDEO.canPlayType(VIDEO_MOV_TYPE).replace('no', '') || IS_IOS || IS_MAC_OS,
);

if (IS_MOV_SUPPORTED) {
  SUPPORTED_VIDEO_CONTENT_TYPES.add(VIDEO_MOV_TYPE);
  CONTENT_TYPES_WITH_PREVIEW.add(VIDEO_MOV_TYPE);
}

export const IS_WEBM_SUPPORTED = Boolean(TEST_VIDEO.canPlayType('video/webm; codecs="vp9"').replace('no', ''))
  && !(IS_MAC_OS && IS_SAFARI); // Safari on MacOS has some issues with WebM

export const DPR = window.devicePixelRatio || 1;

export const MASK_IMAGE_DISABLED = true;
export const IS_OPFS_SUPPORTED = Boolean(navigator.storage?.getDirectory);
if (IS_OPFS_SUPPORTED) {
  // Clear old contents
  (async () => {
    try {
      const directory = await navigator.storage.getDirectory();
      await directory.removeEntry('downloads', { recursive: true });
    } catch {
      // Ignore
    }
  })();
}

export const IS_BACKDROP_BLUR_SUPPORTED = !IS_TEST && (
  CSS.supports('backdrop-filter: blur()') || CSS.supports('-webkit-backdrop-filter: blur()')
);
export const IS_COMPACT_MENU = !IS_TOUCH_ENV;
export const IS_SCROLL_PATCH_NEEDED = !IS_MAC_OS && !IS_IOS && !IS_ANDROID;
export const IS_INSTALL_PROMPT_SUPPORTED = 'onbeforeinstallprompt' in window;

// Smaller area reduces scroll jumps caused by `patchChromiumScroll`
export const MESSAGE_LIST_SENSITIVE_AREA = IS_SCROLL_PATCH_NEEDED ? 300 : 750;

export const MAX_BUFFER_SIZE = (IS_ANDROID || IS_IOS ? 512 : 2000) * 1024 ** 2; // 512 OR 2000 MB

// TODO Turn on later as `!IS_IOS && !IS_ANDROID`
export const VIDEO_AVATARS_DISABLED = true;

function isLastEmojiVersionSupported() {
  const ALLOWABLE_CALCULATION_ERROR_SIZE = 5;
  const inlineEl = document.createElement('span');
  inlineEl.classList.add('emoji-test-element');
  document.body.appendChild(inlineEl);

  inlineEl.innerText = '🫱🏻'; // Emoji from 14.0 version
  const newEmojiWidth = inlineEl.offsetWidth;
  inlineEl.innerText = '❤️'; // Emoji from 1.0 version
  const legacyEmojiWidth = inlineEl.offsetWidth;

  document.body.removeChild(inlineEl);

  return Math.abs(newEmojiWidth - legacyEmojiWidth) < ALLOWABLE_CALCULATION_ERROR_SIZE;
}
