import type { IDimensions } from '../types';

import { requestMutation } from '../lib/fasterdom/fasterdom';
import { IS_IOS } from './browser/windowEnvironment';
import { throttle } from './schedulers';

const WINDOW_ORIENTATION_CHANGE_THROTTLE_MS = 100;
const WINDOW_RESIZE_THROTTLE_MS = 250;

let initialHeight = window.innerHeight;
let currentWindowSize = updateSizes();

const handleResize = throttle(() => {
  currentWindowSize = updateSizes();
}, WINDOW_RESIZE_THROTTLE_MS, true);

const handleOrientationChange = throttle(() => {
  initialHeight = window.innerHeight;
  handleResize();
}, WINDOW_ORIENTATION_CHANGE_THROTTLE_MS, false);

window.addEventListener('orientationchange', handleOrientationChange);
if (IS_IOS) {
  window.visualViewport!.addEventListener('resize', handleResize);
} else {
  window.addEventListener('resize', handleResize);
}

// Measured outside render, so reading sizes of a PiP window does not force layout during mutations
const pictureInPictureSizes = new WeakMap<Window, IDimensions>();

window.documentPictureInPicture?.addEventListener('enter', (e) => {
  const pictureInPictureWindow = (e as Event & { window: Window }).window;
  const measure = () => {
    pictureInPictureSizes.set(pictureInPictureWindow, {
      width: pictureInPictureWindow.innerWidth,
      height: pictureInPictureWindow.innerHeight,
    });
  };

  measure();
  pictureInPictureWindow.addEventListener('resize', throttle(measure, WINDOW_RESIZE_THROTTLE_MS, true));
});

export function updateSizes(): IDimensions {
  let height: number;
  if (IS_IOS) {
    height = window.visualViewport!.height + window.visualViewport!.pageTop;
  } else {
    height = window.innerHeight;
  }

  requestMutation(() => {
    const vh = height * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  });

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

const windowSize = {
  get: (targetWindow?: Window) => (targetWindow && pictureInPictureSizes.get(targetWindow)) || currentWindowSize,
  getIsKeyboardVisible: () => initialHeight > currentWindowSize.height,
};

export default windowSize;
