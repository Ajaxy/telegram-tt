import type { ApiMessage } from '../../../../api/types';
import { calculateInlineImageDimensions, calculateVideoDimensions } from '../../../common/helpers/mediaDimensions';
import {
  getMessageText,
  getMessagePhoto,
  getMessageWebPagePhoto,
  isForwardedMessage,
  isOwnMessage,
  getMessageVideo,
} from '../../../../global/helpers';

const MIN_MEDIA_WIDTH = 100;
const MIN_MEDIA_WIDTH_WITH_COMMENTS = 238;
const MIN_MEDIA_WIDTH_WITH_TEXT = 175;
const MIN_MEDIA_WIDTH_WITH_TEXT_AND_COMMENTS = 238;
const MIN_MEDIA_HEIGHT = 90;
const SMALL_IMAGE_THRESHOLD = 12;

export function getMinMediaWidth(hasText?: boolean, hasCommentButton?: boolean) {
  return hasText
    ? (hasCommentButton ? MIN_MEDIA_WIDTH_WITH_TEXT_AND_COMMENTS : MIN_MEDIA_WIDTH_WITH_TEXT)
    : (hasCommentButton ? MIN_MEDIA_WIDTH_WITH_COMMENTS : MIN_MEDIA_WIDTH);
}

export function calculateMediaDimensions(message: ApiMessage, noAvatars?: boolean) {
  const isOwn = isOwnMessage(message);
  const isForwarded = isForwardedMessage(message);
  const photo = getMessagePhoto(message) || getMessageWebPagePhoto(message);
  const video = getMessageVideo(message);

  const isWebPagePhoto = Boolean(getMessageWebPagePhoto(message));
  const { width, height } = photo
    ? calculateInlineImageDimensions(photo, isOwn, isForwarded, isWebPagePhoto, noAvatars)
    : calculateVideoDimensions(video!, isOwn, isForwarded, noAvatars);

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
