import type { ApiMessage } from '../../../../api/types';

import {
  getMessagePhoto,
  getMessageText,
  getMessageVideo,
  getMessageWebPagePhoto,
  getMessageWebPageVideo,
  isOwnMessage,
} from '../../../../global/helpers';
import { calculateInlineImageDimensions, calculateVideoDimensions, REM } from '../../../common/helpers/mediaDimensions';

const SMALL_IMAGE_THRESHOLD = 12;
const MIN_MESSAGE_LENGTH_FOR_BLUR = 40;
export const MIN_MEDIA_WIDTH_WITH_TEXT = 20 * REM;
const MIN_MEDIA_WIDTH = SMALL_IMAGE_THRESHOLD * REM;
export const MIN_MEDIA_HEIGHT = 5 * REM;

export function getMinMediaWidth(text?: string, hasCommentButton?: boolean) {
  return (text?.length ?? 0) > MIN_MESSAGE_LENGTH_FOR_BLUR || hasCommentButton
    ? MIN_MEDIA_WIDTH_WITH_TEXT
    : MIN_MEDIA_WIDTH;
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

  const messageText = getMessageText(message);
  const minMediaWidth = getMinMediaWidth(messageText);

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
