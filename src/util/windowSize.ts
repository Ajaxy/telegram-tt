import type { IDimensions } from '../global/types';

import { requestMutation } from '../lib/fasterdom/fasterdom';
import { throttle } from './schedulers';
import { IS_IOS } from './windowEnvironment';

const getInnerHeight = () => {
  let height = window.innerHeight;
  // @ts-ignore
  let body = window.document.querySelector('.telegram-a') as Element;
  let document = window.document;
  // @ts-ignore
  // eslint-disable-next-line no-underscore-dangle
  if (window.__MICRO_APP_ENVIRONMENT__) {
    // @ts-ignore
    // eslint-disable-next-line max-len
    body = (document?.microAppElement?.querySelector?.('.telegram-a')
      || document.querySelector('.telegram-a')) as Element;
    // @ts-ignore
    document = window?.rawDocument || window.document;
    const bodyRect = body.getBoundingClientRect();
    height = bodyRect.height;
  }
  return height;
};

const WINDOW_ORIENTATION_CHANGE_THROTTLE_MS = 100;
const WINDOW_RESIZE_THROTTLE_MS = 250;

let initialHeight = getInnerHeight();
let currentWindowSize = updateSizes();

const handleResize = throttle(
  () => {
    currentWindowSize = updateSizes();
  },
  WINDOW_RESIZE_THROTTLE_MS,
  true,
);

const handleOrientationChange = throttle(
  () => {
    initialHeight = getInnerHeight();
    handleResize();
  },
  WINDOW_ORIENTATION_CHANGE_THROTTLE_MS,
  false,
);

window.addEventListener('orientationchange', handleOrientationChange);
if (IS_IOS) {
  window.visualViewport!.addEventListener('resize', handleResize);
} else {
  window.addEventListener('resize', handleResize);
}

export function updateSizes(): IDimensions {
  let height: number;
  let dimensions = {
    width: window.innerWidth,
    height: getInnerHeight(),
  };
  if (IS_IOS) {
    height = window.visualViewport!.height + window.visualViewport!.pageTop;
  } else {
    height = getInnerHeight();
  }

  // @ts-ignore
  let body = window.document.querySelector('.telegram-a') as Element;
  let document = window.document;
  // @ts-ignore
  // eslint-disable-next-line no-underscore-dangle
  if (window.__MICRO_APP_ENVIRONMENT__) {
    // @ts-ignore
    // eslint-disable-next-line max-len
    body = (document?.microAppElement?.querySelector?.('.telegram-a')
      || document.querySelector('.telegram-a')) as Element;
    // @ts-ignore
    document = window?.rawDocument || window.document;
    const bodyRect = body.getBoundingClientRect();
    height = bodyRect.height;
    dimensions = {
      height: bodyRect.height,
      width: bodyRect.width,
    };
  }

  requestMutation(() => {
    const vh = height * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  });

  return dimensions;
}

const windowSize = {
  get: () => currentWindowSize,
  getIsKeyboardVisible: () => initialHeight > currentWindowSize.height,
};

export default windowSize;
