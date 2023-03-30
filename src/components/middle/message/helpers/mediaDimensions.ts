import type { ApiMessage } from '../../../../api/types';
import { calculateInlineImageDimensions, calculateVideoDimensions, REM } from '../../../common/helpers/mediaDimensions';
import {
  getMessageText,
  getMessagePhoto,
  getMessageWebPagePhoto,
  isOwnMessage,
  getMessageVideo,
  getMessageWebPageVideo,
} from '../../../../global/helpers';

export const MIN_MEDIA_WIDTH_WITH_COMMENTS = 20 * REM;
export const MIN_MEDIA_WIDTH_WITH_TEXT = 15 * REM;
const MIN_MEDIA_WIDTH_WITH_TEXT_AND_COMMENTS = 20 * REM;
const MIN_MEDIA_WIDTH = 7 * REM;
export const MIN_MEDIA_HEIGHT = 5 * REM;
const SMALL_IMAGE_THRESHOLD = 12;

export function getMinMediaWidth(hasText?: boolean, hasCommentButton?: boolean) {
  return hasText
    ? (hasCommentButton ? MIN_MEDIA_WIDTH_WITH_TEXT_AND_COMMENTS : MIN_MEDIA_WIDTH_WITH_TEXT)
    : (hasCommentButton ? MIN_MEDIA_WIDTH_WITH_COMMENTS : MIN_MEDIA_WIDTH);
}

export function calculateMediaDimensions(
  message: ApiMessage, asForwarded?: boolean, noAvatars?: boolean, isMobile?: boolean,
) {
  const isOwn = isOwnMessage(message);
  const photo = getMessagePhoto(message) || getMessageWebPagePhoto(message);
  const video = getMessageVideo(message);

  const isWebPagePhoto = Boolean(getMessageWebPagePhoto(message));
  const isWebPageVideo = Boolean(getMessageWebPageVideo(message));
  const { width, height } = photo
    ? calculateInlineImageDimensions(photo, isOwn, asForwarded, isWebPagePhoto, noAvatars, isMobile)
    : calculateVideoDimensions(video!, isOwn, asForwarded, isWebPageVideo, noAvatars, isMobile);

  const hasText = Boolean(getMessageText(message));
  const minMediaWidth = getMinMediaWidth(hasText);

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
