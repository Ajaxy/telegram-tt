import type {
  ApiDimensions, ApiSticker,
} from '../../../api/types';

import { STICKER_SIZE_INLINE_DESKTOP_FACTOR, STICKER_SIZE_INLINE_MOBILE_FACTOR } from '../../../config';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import windowSize from '../../../util/windowSize';

export const MEDIA_VIEWER_MEDIA_QUERY = '(max-height: 640px)';
export const REM = parseInt(getComputedStyle(document.documentElement).fontSize, 10);
export const ROUND_VIDEO_DIMENSIONS_PX = 240;
export const AVATAR_FULL_DIMENSIONS = { width: 640, height: 640 };
export const VIDEO_AVATAR_FULL_DIMENSIONS = { width: 800, height: 800 };
export const LIKE_STICKER_ID = '4986041492570112461';

export function getMediaViewerAvailableDimensions(withFooter: boolean, isVideo: boolean): ApiDimensions {
  const mql = window.matchMedia(MEDIA_VIEWER_MEDIA_QUERY);
  const { width: windowWidth, height: windowHeight } = windowSize.get();
  let occupiedHeightRem = isVideo && mql.matches ? 10 : 8.25;
  if (withFooter && !IS_TOUCH_ENV) {
    occupiedHeightRem = mql.matches ? 10 : 12.5;
  }
  return {
    width: windowWidth,
    height: windowHeight - occupiedHeightRem * REM,
  };
}

export function getDocumentThumbnailDimensions(
  size: 'small' | 'medium' | 'large' = 'medium',
): ApiDimensions {
  switch (size) {
    case 'small':
      return {
        width: 3 * REM,
        height: 3 * REM,
      };
    case 'large':
      return {
        width: 4.5 * REM,
        height: 4.5 * REM,
      };
    default:
      return {
        width: 3.375 * REM,
        height: 3.375 * REM,
      };
  }
}

export function getStickerDimensions(sticker: ApiSticker, isMobile?: boolean): ApiDimensions {
  const { width } = sticker;
  let { height } = sticker;

  // For some reason this sticker has some weird `height` value
  if (sticker.id === LIKE_STICKER_ID) {
    height = width;
  }

  const aspectRatio = (height && width) && height / width;
  const baseWidth = REM * (
    isMobile
      ? STICKER_SIZE_INLINE_MOBILE_FACTOR
      : STICKER_SIZE_INLINE_DESKTOP_FACTOR
  );
  const calculatedHeight = aspectRatio ? baseWidth * aspectRatio : baseWidth;

  if (aspectRatio && calculatedHeight > baseWidth) {
    return {
      width: Math.round(baseWidth / aspectRatio),
      height: baseWidth,
    };
  }

  return {
    width: baseWidth,
    height: calculatedHeight,
  };
}

export function calculateMediaViewerDimensions(
  { width, height }: ApiDimensions, withFooter: boolean, isVideo: boolean = false,
): ApiDimensions {
  const { width: availableWidth, height: availableHeight } = getMediaViewerAvailableDimensions(withFooter, isVideo);

  return calculateDimensions(availableWidth, availableHeight, width, height);
}

export function calculateDimensions(
  availableWidth: number,
  availableHeight: number,
  mediaWidth: number,
  mediaHeight: number,
): ApiDimensions {
  const aspectRatio = mediaHeight / mediaWidth;
  const calculatedWidth = Math.min(mediaWidth, availableWidth);
  const calculatedHeight = Math.round(calculatedWidth * aspectRatio);

  if (calculatedHeight > availableHeight) {
    return {
      width: Math.round(availableHeight / aspectRatio),
      height: availableHeight,
    };
  }

  return {
    width: calculatedWidth,
    height: Math.round(calculatedWidth * aspectRatio),
  };
}
