import type {
  ApiDimensions, ApiMediaExtendedPreview, ApiPhoto, ApiSticker, ApiVideo,
} from '../../../api/types';

import { STICKER_SIZE_INLINE_DESKTOP_FACTOR, STICKER_SIZE_INLINE_MOBILE_FACTOR } from '../../../config';
import { getPhotoInlineDimensions, getVideoDimensions } from '../../../global/helpers';
import { IS_TOUCH_ENV } from '../../../util/windowEnvironment';
import windowSize from '../../../util/windowSize';

export const MEDIA_VIEWER_MEDIA_QUERY = '(max-height: 640px)';
export const REM = parseInt(getComputedStyle(document.documentElement).fontSize, 10);
export const ROUND_VIDEO_DIMENSIONS_PX = 240;
export const GIF_MIN_WIDTH = 300;
export const AVATAR_FULL_DIMENSIONS = { width: 640, height: 640 };
export const VIDEO_AVATAR_FULL_DIMENSIONS = { width: 800, height: 800 };
export const LIKE_STICKER_ID = '4986041492570112461';

const DEFAULT_MEDIA_DIMENSIONS: ApiDimensions = { width: 100, height: 100 };
const MOBILE_SCREEN_NO_AVATARS_MESSAGE_EXTRA_WIDTH_REM = 4.5;
const MOBILE_SCREEN_MESSAGE_EXTRA_WIDTH_REM = 7;
const MESSAGE_MAX_WIDTH_REM = 29;
const MESSAGE_OWN_MAX_WIDTH_REM = 30;

let cachedMaxWidthOwn: number | undefined;
let cachedMaxWidth: number | undefined;
let cachedMaxWidthNoAvatar: number | undefined;

function getMaxMessageWidthRem(fromOwnMessage?: boolean, noAvatars?: boolean, isMobile?: boolean) {
  const regularMaxWidth = fromOwnMessage ? MESSAGE_OWN_MAX_WIDTH_REM : MESSAGE_MAX_WIDTH_REM;
  if (!isMobile) {
    return regularMaxWidth;
  }

  const { width: windowWidth } = windowSize.get();

  // @optimization Limitation: changing device screen width not supported
  if (!cachedMaxWidthOwn) {
    cachedMaxWidthOwn = Math.min(
      MESSAGE_OWN_MAX_WIDTH_REM,
      windowWidth / REM - MOBILE_SCREEN_NO_AVATARS_MESSAGE_EXTRA_WIDTH_REM,
    );
  }
  if (!cachedMaxWidth) {
    cachedMaxWidth = Math.min(
      MESSAGE_MAX_WIDTH_REM,
      windowWidth / REM - MOBILE_SCREEN_MESSAGE_EXTRA_WIDTH_REM,
    );
  }
  if (!cachedMaxWidthNoAvatar) {
    cachedMaxWidthNoAvatar = Math.min(
      MESSAGE_MAX_WIDTH_REM,
      windowWidth / REM - MOBILE_SCREEN_NO_AVATARS_MESSAGE_EXTRA_WIDTH_REM,
    );
  }

  return fromOwnMessage
    ? cachedMaxWidthOwn
    : (noAvatars ? cachedMaxWidthNoAvatar : cachedMaxWidth);
}

export function getAvailableWidth(
  fromOwnMessage?: boolean,
  isWebPageMedia?: boolean,
  noAvatars?: boolean,
  isMobile?: boolean,
) {
  const extraPaddingRem = isWebPageMedia ? 1.625 : 0;
  const availableWidthRem = getMaxMessageWidthRem(fromOwnMessage, noAvatars, isMobile) - extraPaddingRem;

  return availableWidthRem * REM;
}

function getAvailableHeight(isGif?: boolean, aspectRatio?: number) {
  if (
    isGif && aspectRatio
    && aspectRatio >= 0.75 && aspectRatio <= 1.25
  ) {
    return 20 * REM;
  }

  return 27 * REM;
}

export function calculateDimensionsForMessageMedia({
  width,
  height,
  fromOwnMessage,
  isWebPageMedia,
  isGif,
  noAvatars,
  isMobile,
}: {
  width: number;
  height: number;
  fromOwnMessage?: boolean;
  asForwarded?: boolean;
  isWebPageMedia?: boolean;
  isGif?: boolean;
  noAvatars?: boolean;
  isMobile?: boolean;
}): ApiDimensions {
  const aspectRatio = height / width;
  const availableWidth = getAvailableWidth(fromOwnMessage, isWebPageMedia, noAvatars, isMobile);
  const availableHeight = getAvailableHeight(isGif, aspectRatio);
  const mediaWidth = isGif ? Math.max(GIF_MIN_WIDTH, width) : width;
  const mediaHeight = isGif ? height * (mediaWidth / width) : height;

  return calculateDimensions(availableWidth, availableHeight, mediaWidth, mediaHeight);
}

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

export function calculateInlineImageDimensions(
  photo: ApiPhoto,
  fromOwnMessage?: boolean,
  asForwarded?: boolean,
  isWebPageMedia?: boolean,
  noAvatars?: boolean,
  isMobile?: boolean,
) {
  const { width, height } = getPhotoInlineDimensions(photo) || DEFAULT_MEDIA_DIMENSIONS;

  return calculateDimensionsForMessageMedia({
    width,
    height,
    fromOwnMessage,
    asForwarded,
    isWebPageMedia,
    noAvatars,
    isMobile,
  });
}

export function calculateVideoDimensions(
  video: ApiVideo,
  fromOwnMessage?: boolean,
  asForwarded?: boolean,
  isWebPageMedia?: boolean,
  noAvatars?: boolean,
  isMobile?: boolean,
) {
  const { width, height } = getVideoDimensions(video) || DEFAULT_MEDIA_DIMENSIONS;

  return calculateDimensionsForMessageMedia({
    width,
    height,
    fromOwnMessage,
    asForwarded,
    isWebPageMedia,
    isGif: video.isGif,
    noAvatars,
    isMobile,
  });
}

export function calculateExtendedPreviewDimensions(
  preview: ApiMediaExtendedPreview,
  fromOwnMessage?: boolean,
  asForwarded?: boolean,
  isWebPageMedia?: boolean,
  noAvatars?: boolean,
  isMobile?: boolean,
) {
  const { width = DEFAULT_MEDIA_DIMENSIONS.width, height = DEFAULT_MEDIA_DIMENSIONS.height } = preview;

  return calculateDimensionsForMessageMedia({
    width,
    height,
    fromOwnMessage,
    asForwarded,
    isWebPageMedia,
    noAvatars,
    isMobile,
  });
}

export function getPictogramDimensions(): ApiDimensions {
  return {
    width: 2 * REM,
    height: 2 * REM,
  };
}

export function getDocumentThumbnailDimensions(smaller?: boolean): ApiDimensions {
  if (smaller) {
    return {
      width: 3 * REM,
      height: 3 * REM,
    };
  }

  return {
    width: 3.375 * REM,
    height: 3.375 * REM,
  };
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
