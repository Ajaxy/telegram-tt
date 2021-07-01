import {
  MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN,
  MOBILE_SCREEN_MAX_WIDTH,
  MOBILE_SCREEN_LANDSCAPE_MAX_HEIGHT,
  MOBILE_SCREEN_LANDSCAPE_MAX_WIDTH,
  IS_TEST,
} from '../config';

export * from './environmentWebp';

export * from './environmentSystemTheme';

export function getPlatform() {
  const { userAgent, platform } = window.navigator;
  const macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
  const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
  const iosPlatforms = ['iPhone', 'iPad', 'iPod'];
  let os: 'macOS' | 'iOS' | 'Windows' | 'Android' | 'Linux' | undefined;

  if (macosPlatforms.indexOf(platform) !== -1) {
    os = 'macOS';
  } else if (iosPlatforms.indexOf(platform) !== -1) {
    os = 'iOS';
  } else if (windowsPlatforms.indexOf(platform) !== -1) {
    os = 'Windows';
  } else if (/Android/.test(userAgent)) {
    os = 'Android';
  } else if (/Linux/.test(platform)) {
    os = 'Linux';
  }

  return os;
}

export const PLATFORM_ENV = getPlatform();
export const IS_MAC_OS = PLATFORM_ENV === 'macOS';
export const IS_IOS = PLATFORM_ENV === 'iOS';
export const IS_ANDROID = PLATFORM_ENV === 'Android';
export const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export const IS_TOUCH_ENV = window.matchMedia('(pointer: coarse)').matches;
// Keep in mind the landscape orientation
export const IS_SINGLE_COLUMN_LAYOUT = window.innerWidth <= MOBILE_SCREEN_MAX_WIDTH || (
  window.innerWidth <= MOBILE_SCREEN_LANDSCAPE_MAX_WIDTH && window.innerHeight <= MOBILE_SCREEN_LANDSCAPE_MAX_HEIGHT
);
// Special layout, 1 column while chat opened, 2 columns while collapsed
export const IS_TABLET_COLUMN_LAYOUT = !IS_SINGLE_COLUMN_LAYOUT && (
  window.innerWidth <= MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN
);
export const IS_VOICE_RECORDING_SUPPORTED = (navigator.mediaDevices && 'getUserMedia' in navigator.mediaDevices && (
  window.AudioContext || (window as any).webkitAudioContext
));
export const IS_SMOOTH_SCROLL_SUPPORTED = 'scrollBehavior' in document.documentElement.style;
export const IS_EMOJI_SUPPORTED = PLATFORM_ENV && (IS_MAC_OS || IS_IOS);
export const IS_SERVICE_WORKER_SUPPORTED = 'serviceWorker' in navigator;
// TODO Consider failed service worker
export const IS_PROGRESSIVE_SUPPORTED = IS_SERVICE_WORKER_SUPPORTED;
export const IS_STREAMING_SUPPORTED = 'MediaSource' in window;
export const IS_OPUS_SUPPORTED = Boolean((new Audio()).canPlayType('audio/ogg; codecs=opus'));
export const IS_CANVAS_FILTER_SUPPORTED = (
  !IS_TEST && 'filter' in (document.createElement('canvas').getContext('2d') || {})
);

export const DPR = window.devicePixelRatio || 1;

export const MASK_IMAGE_DISABLED = true;
