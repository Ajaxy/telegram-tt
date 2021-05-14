import { throttle } from './schedulers';
import {
  MOBILE_SCREEN_LANDSCAPE_MAX_HEIGHT,
  MOBILE_SCREEN_LANDSCAPE_MAX_WIDTH,
  MOBILE_SCREEN_MAX_WIDTH,
} from '../config';
import { IS_MOBILE_SCREEN } from './environment';

type IDimensions = {
  width: number;
  height: number;
};

const IS_LANDSCAPE = IS_MOBILE_SCREEN && isLandscape();

let windowSize = updateSizes();

const handleResize = throttle(() => {
  windowSize = updateSizes();

  if ((isMobileScreen() !== IS_MOBILE_SCREEN) || (IS_MOBILE_SCREEN && IS_LANDSCAPE !== isLandscape())) {
    window.location.reload();
  }
}, 250, true);

window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', handleResize);

export function updateSizes(): IDimensions {
  const vh = window.innerHeight * 0.01;

  document.documentElement.style.setProperty('--vh', `${vh}px`);

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function isMobileScreen() {
  return windowSize.width <= MOBILE_SCREEN_MAX_WIDTH || (
    windowSize.width <= MOBILE_SCREEN_LANDSCAPE_MAX_WIDTH && windowSize.height <= MOBILE_SCREEN_LANDSCAPE_MAX_HEIGHT
  );
}

function isLandscape() {
  return window.matchMedia('(orientation: landscape)').matches;
}

export default {
  get: () => windowSize,
};
