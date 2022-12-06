import { throttle } from './schedulers';
import {
  MOBILE_SCREEN_LANDSCAPE_MAX_HEIGHT,
  MOBILE_SCREEN_LANDSCAPE_MAX_WIDTH,
  MOBILE_SCREEN_MAX_WIDTH,
} from '../config';
import { IS_IOS, IS_SINGLE_COLUMN_LAYOUT } from './environment';

type IDimensions = {
  width: number;
  height: number;
};

const IS_LANDSCAPE = IS_SINGLE_COLUMN_LAYOUT && isLandscape();

const initialHeight = window.innerHeight;
let currentWindowSize = updateSizes();
let isRefreshDisabled = false;

function disableRefresh() {
  isRefreshDisabled = true;
}

function enableRefresh() {
  isRefreshDisabled = false;
}

const handleResize = throttle(() => {
  currentWindowSize = updateSizes();

  if (!isRefreshDisabled && (
    isMobileScreen() !== IS_SINGLE_COLUMN_LAYOUT
    || (IS_SINGLE_COLUMN_LAYOUT && IS_LANDSCAPE !== isLandscape())
  )) {
    window.location.reload();
  }
}, 250, true);

window.addEventListener('orientationchange', handleResize);
if (IS_IOS) {
  window.visualViewport!.addEventListener('resize', handleResize);
} else {
  window.addEventListener('resize', handleResize);
}

export function updateSizes(): IDimensions {
  let height: number;
  if (IS_IOS) {
    height = window.visualViewport!.height + window.visualViewport!.pageTop;
  } else {
    height = window.innerHeight;
  }
  const vh = height * 0.01;

  document.documentElement.style.setProperty('--vh', `${vh}px`);

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function isMobileScreen() {
  return currentWindowSize.width <= MOBILE_SCREEN_MAX_WIDTH || (
    currentWindowSize.width <= MOBILE_SCREEN_LANDSCAPE_MAX_WIDTH
    && currentWindowSize.height <= MOBILE_SCREEN_LANDSCAPE_MAX_HEIGHT
  );
}

function isLandscape() {
  if (IS_IOS) {
    return window.matchMedia('(orientation: landscape)').matches;
  }

  // eslint-disable-next-line max-len
  // Source: https://web.archive.org/web/20160509220835/http://blog.abouthalf.com/development/orientation-media-query-challenges-in-android-browsers/
  // Feature is marked as deprecated now, but it is still supported
  // https://developer.mozilla.org/en-US/docs/Web/CSS/@media/device-aspect-ratio#browser_compatibility
  return window.matchMedia('screen and (min-device-aspect-ratio: 1/1) and (orientation: landscape)').matches;
}

const windowSize = {
  get: () => currentWindowSize,
  getIsKeyboardVisible: () => initialHeight > currentWindowSize.height,
  disableRefresh,
  enableRefresh,
};

export default windowSize;
