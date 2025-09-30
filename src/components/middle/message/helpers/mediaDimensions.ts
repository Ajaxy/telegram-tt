import type { ApiMediaExtendedPreview, ApiPhoto, ApiVideo } from '../../../../api/types';

import {
  calculateExtendedPreviewDimensions,
  calculateInlineImageDimensions,
  calculateVideoDimensions,
  REM,
} from '../../../common/helpers/mediaDimensions';

const SMALL_IMAGE_THRESHOLD = 12;
const MIN_MESSAGE_LENGTH_FOR_BLUR = 40;
const MIN_MEDIA_WIDTH = SMALL_IMAGE_THRESHOLD * REM;
export const MIN_MEDIA_HEIGHT = 5 * REM;

export function getMinMediaWidthWithText(isMobile: boolean) {
  return (isMobile ? 14 : 20) * REM;
}

export function getMinMediaWidth(text: string = '', isMobile: boolean, hasCommentButton?: boolean) {
  return text.length > MIN_MESSAGE_LENGTH_FOR_BLUR || hasCommentButton
    ? getMinMediaWidthWithText(isMobile)
    : MIN_MEDIA_WIDTH;
}

export function calculateMediaDimensions({
  media,
  messageText,
  isOwn,
  isInWebPage,
  asForwarded,
  noAvatars,
  isMobile,
}: {
  media: ApiPhoto | ApiVideo | ApiMediaExtendedPreview;
  messageText?: string;
  isOwn?: boolean;
  isInWebPage?: boolean;
  asForwarded?: boolean;
  noAvatars?: boolean;
  isMobile: boolean;
}) {
  const isPhoto = media.mediaType === 'photo';
  const isVideo = media.mediaType === 'video';
  const isWebPagePhoto = isPhoto && isInWebPage;
  const isWebPageVideo = isVideo && isInWebPage;
  const { width, height } = isPhoto
    ? calculateInlineImageDimensions(media, isOwn, asForwarded, isWebPagePhoto, noAvatars, isMobile)
    : isVideo ? calculateVideoDimensions(media, isOwn, asForwarded, isWebPageVideo, noAvatars, isMobile)
      : calculateExtendedPreviewDimensions(media, isOwn, asForwarded, isInWebPage, noAvatars, isMobile);

  const minMediaWidth = getMinMediaWidth(messageText, isMobile);

  let stretchFactor = 1;
  if (width < minMediaWidth && minMediaWidth - width < SMALL_IMAGE_THRESHOLD) {
    stretchFactor = minMediaWidth / width;
  }
  if (height * stretchFactor < MIN_MEDIA_HEIGHT && MIN_MEDIA_HEIGHT - height * stretchFactor < SMALL_IMAGE_THRESHOLD) {
    stretchFactor = MIN_MEDIA_HEIGHT / height;
  }

  const finalWidth = Math.round(width * stretchFactor);
  const finalHeight = Math.round(height * stretchFactor);

  return {
    width: finalWidth,
    height: finalHeight,
    isSmall: finalWidth < minMediaWidth || finalHeight < MIN_MEDIA_HEIGHT,
  };
}
