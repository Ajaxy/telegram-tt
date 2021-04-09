import { ApiPhoto, ApiVideo, ApiSticker } from '../../../api/types';
import { getPhotoInlineDimensions, getVideoDimensions, IDimensions } from '../../../modules/helpers';
import windowSize from '../../../util/windowSize';
import { IS_MOBILE_SCREEN } from '../../../util/environment';
import { STICKER_SIZE_INLINE_DESKTOP_FACTOR, STICKER_SIZE_INLINE_MOBILE_FACTOR } from '../../../config';

export const MEDIA_VIEWER_MEDIA_QUERY = '(max-height: 640px)';
export const REM = parseInt(getComputedStyle(document.documentElement).fontSize, 10);
export const ROUND_VIDEO_DIMENSIONS = 200;
export const AVATAR_FULL_DIMENSIONS = { width: 640, height: 640 };

const DEFAULT_MEDIA_DIMENSIONS: IDimensions = { width: 100, height: 100 };
const LIKE_STICKER_ID = '1258816259753933';
const MOBILE_SCREEN_MAX_MESSAGE_SCREEN_WIDTH = 0.69;

let cachedMaxWidth: number | undefined;

function getMaxMessageWidthRem(fromOwnMessage: boolean) {
  const regularMaxWidth = fromOwnMessage ? 30 : 29;
  if (!IS_MOBILE_SCREEN) {
    return regularMaxWidth;
  }

  // @optimization Limitation: changing device screen width not supported
  if (!cachedMaxWidth) {
    cachedMaxWidth = Math.min(
      regularMaxWidth,
      Math.floor(window.innerWidth * MOBILE_SCREEN_MAX_MESSAGE_SCREEN_WIDTH) / REM,
    );
  }

  return cachedMaxWidth;
}

function getAvailableWidth(
  fromOwnMessage: boolean,
  isForwarded?: boolean,
  isWebPagePhoto?: boolean,
) {
  const extraPaddingRem = isForwarded || isWebPagePhoto ? 1.625 : 0;
  const availableWidthRem = getMaxMessageWidthRem(fromOwnMessage) - extraPaddingRem;

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

function calculateDimensionsForMessageMedia({
  width,
  height,
  fromOwnMessage,
  isForwarded,
  isWebPagePhoto,
  isGif,
}: {
  width: number;
  height: number;
  fromOwnMessage: boolean;
  isForwarded?: boolean;
  isWebPagePhoto?: boolean;
  isGif?: boolean;
}): IDimensions {
  const aspectRatio = height / width;
  const availableWidth = getAvailableWidth(fromOwnMessage, isForwarded, isWebPagePhoto);
  const availableHeight = getAvailableHeight(isGif, aspectRatio);

  return calculateDimensions(availableWidth, availableHeight, width, height);
}

export function getMediaViewerAvailableDimensions(withFooter: boolean, isVideo: boolean): IDimensions {
  const mql = window.matchMedia(MEDIA_VIEWER_MEDIA_QUERY);
  const { width: windowWidth, height: windowHeight } = windowSize.get();
  let occupiedHeightRem = isVideo && mql.matches ? 10 : 8.25;
  if (withFooter) {
    occupiedHeightRem = mql.matches ? 10 : 15;
  }

  return {
    width: windowWidth,
    height: windowHeight - occupiedHeightRem * REM,
  };
}

export function calculateInlineImageDimensions(
  photo: ApiPhoto,
  fromOwnMessage: boolean,
  isForwarded?: boolean,
  isWebPagePhoto?: boolean,
) {
  const { width, height } = getPhotoInlineDimensions(photo) || DEFAULT_MEDIA_DIMENSIONS;

  return calculateDimensionsForMessageMedia({
    width,
    height,
    fromOwnMessage,
    isForwarded,
    isWebPagePhoto,
  });
}

export function calculateVideoDimensions(
  video: ApiVideo,
  fromOwnMessage: boolean,
  isForwarded?: boolean,
) {
  const { width, height } = getVideoDimensions(video) || DEFAULT_MEDIA_DIMENSIONS;

  return calculateDimensionsForMessageMedia({
    width,
    height,
    fromOwnMessage,
    isForwarded,
    isGif: video.isGif,
  });
}

export function getPictogramDimensions(): IDimensions {
  return {
    width: 2 * REM,
    height: 2 * REM,
  };
}

export function getDocumentThumbnailDimensions(smaller?: boolean): IDimensions {
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

export function getStickerDimensions(sticker: ApiSticker): IDimensions {
  const { width } = sticker;
  let { height } = sticker;

  // For some reason this sticker has some weird `height` value
  if (sticker.id === LIKE_STICKER_ID) {
    height = width;
  }

  const aspectRatio = (height && width) && height / width;
  const baseWidth = (IS_MOBILE_SCREEN ? STICKER_SIZE_INLINE_MOBILE_FACTOR : STICKER_SIZE_INLINE_DESKTOP_FACTOR) * REM;
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
  { width, height }: IDimensions, withFooter: boolean, isVideo: boolean = false,
): IDimensions {
  const { width: availableWidth, height: availableHeight } = getMediaViewerAvailableDimensions(withFooter, isVideo);

  return calculateDimensions(availableWidth, availableHeight, width, height);
}

export function calculateDimensions(
  availableWidth: number,
  availableHeight: number,
  mediaWidth: number,
  mediaHeight: number,
): IDimensions {
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
