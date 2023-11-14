import { useEffect } from 'react';

import {
  MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN,
  MOBILE_SCREEN_LANDSCAPE_MAX_HEIGHT,
  MOBILE_SCREEN_LANDSCAPE_MAX_WIDTH,
  MOBILE_SCREEN_MAX_WIDTH,
} from '../config';
import { createCallbackManager } from '../util/callbacks';
import { IS_IOS } from '../util/windowEnvironment';
import { updateSizes } from '../util/windowSize';
import useForceUpdate from './useForceUpdate.react';

type MediaQueryCacheKey = 'mobile' | 'tablet' | 'landscape' | 'touch';

const mediaQueryCache = new Map<MediaQueryCacheKey, MediaQueryList>();
const callbacks = createCallbackManager();

let isMobile: boolean | undefined;
let isTablet: boolean | undefined;
let isLandscape: boolean | undefined;
let isTouchScreen: boolean | undefined;

export function getIsMobile() {
  return isMobile;
}

export function getIsTablet() {
  return isTablet;
}

function handleMediaQueryChange() {
  isMobile = mediaQueryCache.get('mobile')?.matches || false;
  isTablet = !isMobile && (mediaQueryCache.get('tablet')?.matches || false);
  isLandscape = mediaQueryCache.get('landscape')?.matches || false;
  isTouchScreen = mediaQueryCache.get('touch')?.matches || false;
  updateSizes();
  callbacks.runCallbacks();
}

function initMediaQueryCache() {
  const mobileQuery = window.matchMedia(`(max-width: ${MOBILE_SCREEN_MAX_WIDTH}px), \
  (max-width: ${MOBILE_SCREEN_LANDSCAPE_MAX_WIDTH}px and max-height: ${MOBILE_SCREEN_LANDSCAPE_MAX_HEIGHT}px)`);
  mediaQueryCache.set('mobile', mobileQuery);
  mobileQuery.addEventListener('change', handleMediaQueryChange);

  const tabletQuery = window.matchMedia(`(max-width: ${MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN}px)`);
  mediaQueryCache.set('tablet', tabletQuery);
  tabletQuery.addEventListener('change', handleMediaQueryChange);

  const landscapeQuery = window.matchMedia(
    IS_IOS
      ? '(orientation: landscape)'
      // Source: https://web.archive.org/web/20160509220835/http://blog.abouthalf.com/development/orientation-media-query-challenges-in-android-browsers/
      // Feature is marked as deprecated now, but it is still supported
      // https://developer.mozilla.org/en-US/docs/Web/CSS/@media/device-aspect-ratio#browser_compatibility
      : 'screen and (min-device-aspect-ratio: 1/1) and (orientation: landscape)',
  );
  mediaQueryCache.set('landscape', landscapeQuery);
  landscapeQuery.addEventListener('change', handleMediaQueryChange);

  const isTouchScreenQuery = window.matchMedia('(pointer: coarse)');
  mediaQueryCache.set('touch', isTouchScreenQuery);
  isTouchScreenQuery.addEventListener('change', handleMediaQueryChange);
}

initMediaQueryCache();
handleMediaQueryChange();

export default function useAppLayout() {
  const forceUpdate = useForceUpdate();

  useEffect(() => callbacks.addCallback(forceUpdate), [forceUpdate]);

  return {
    isMobile,
    isTablet,
    isLandscape,
    isDesktop: !isMobile && !isTablet,
    isTouchScreen,
  };
}
