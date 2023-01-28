import { throttle } from './schedulers';
import { IS_IOS } from './environment';

type IDimensions = {
  width: number;
  height: number;
};

const WINDOW_RESIZE_THROTTLE_MS = 250;

const initialHeight = window.innerHeight;
let currentWindowSize = updateSizes();

const handleResize = throttle(() => {
  currentWindowSize = updateSizes();
}, WINDOW_RESIZE_THROTTLE_MS, true);

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

const windowSize = {
  get: () => currentWindowSize,
  getIsKeyboardVisible: () => initialHeight > currentWindowSize.height,
};

export default windowSize;
