import { useMemo } from '../../../lib/teact/teact';

import type {
  ApiMessage, ApiPeer,
} from '../../../api/types';
import { ApiMediaFormat } from '../../../api/types';
import { MediaViewerOrigin } from '../../../types';

import {
  getChatAvatarHash,
  getMessageActionPhoto,
  getMessageDocument,
  getMessageFileName,
  getMessageFileSize,
  getMessageMediaFormat,
  getMessageMediaHash,
  getMessageMediaThumbDataUri,
  getMessagePhoto,
  getMessageVideo,
  getMessageWebPagePhoto,
  getMessageWebPageVideo,
  getPhotoFullDimensions,
  getVideoAvatarMediaHash,
  getVideoDimensions,
  isMessageDocumentPhoto,
  isMessageDocumentVideo,
} from '../../../global/helpers';
import { AVATAR_FULL_DIMENSIONS, VIDEO_AVATAR_FULL_DIMENSIONS } from '../../common/helpers/mediaDimensions';

import useBlurSync from '../../../hooks/useBlurSync';
import useMedia from '../../../hooks/useMedia';
import useMediaWithLoadProgress from '../../../hooks/useMediaWithLoadProgress';

type UseMediaProps = {
  mediaId?: number;
  message?: ApiMessage;
  avatarOwner?: ApiPeer;
  origin?: MediaViewerOrigin;
  delay: number | false;
};

export const useMediaProps = ({
  message,
  mediaId = 0,
  avatarOwner,
  origin,
  delay,
}: UseMediaProps) => {
  const photo = message ? getMessagePhoto(message) : undefined;
  const actionPhoto = message ? getMessageActionPhoto(message) : undefined;
  const video = message ? getMessageVideo(message) : undefined;
  const webPagePhoto = message ? getMessageWebPagePhoto(message) : undefined;
  const webPageVideo = message ? getMessageWebPageVideo(message) : undefined;
  const isDocumentPhoto = message ? isMessageDocumentPhoto(message) : false;
  const isDocumentVideo = message ? isMessageDocumentVideo(message) : false;
  const videoSize = message ? getMessageFileSize(message) : undefined;
  const avatarMedia = avatarOwner?.photos?.[mediaId];
  const isVideoAvatar = Boolean(avatarMedia?.isVideo || actionPhoto?.isVideo);
  const isVideo = Boolean(video || webPageVideo || isDocumentVideo);
  const isPhoto = Boolean(!isVideo && (photo || webPagePhoto || isDocumentPhoto || actionPhoto));
  const { isGif } = video || webPageVideo || {};
  const isFromSharedMedia = origin === MediaViewerOrigin.SharedMedia;
  const isFromSearch = origin === MediaViewerOrigin.SearchResult;

  const getMediaHash = useMemo(() => (isFull?: boolean) => {
    if (avatarOwner) {
      if (avatarMedia) {
        if (avatarMedia.isVideo && isFull) {
          return getVideoAvatarMediaHash(avatarMedia);
        } else if (mediaId === 0) {
          // Show preloaded avatar if this is the first media (when user clicks on profile info avatar)
          return getChatAvatarHash(avatarOwner, isFull ? 'big' : 'normal');
        } else {
          return `photo${avatarMedia.id}?size=c`;
        }
      } else {
        return getChatAvatarHash(avatarOwner, isFull ? 'big' : 'normal');
      }
    }
    if (actionPhoto && isVideoAvatar && isFull) {
      return `videoAvatar${actionPhoto.id}?size=u`;
    }
    return message && getMessageMediaHash(message, isFull ? 'full' : 'preview');
  }, [avatarOwner, actionPhoto, isVideoAvatar, message, avatarMedia, mediaId]);

  const pictogramBlobUrl = useMedia(
    message
    // Only use pictogram if it's already loaded
    && (isFromSharedMedia || isFromSearch || isDocumentPhoto || isDocumentVideo)
    && getMessageMediaHash(message, 'pictogram'),
    undefined,
    ApiMediaFormat.BlobUrl,
    delay,
  );
  const previewMediaHash = getMediaHash();
  const previewBlobUrl = useMedia(
    previewMediaHash,
    undefined,
    ApiMediaFormat.BlobUrl,
    delay,
  );
  const {
    mediaData: fullMediaBlobUrl,
    loadProgress,
  } = useMediaWithLoadProgress(
    getMediaHash(true),
    undefined,
    message && getMessageMediaFormat(message, 'full'),
    delay,
  );

  const localBlobUrl = (photo || video) ? (photo || video)!.blobUrl : undefined;
  let bestImageData = (!isVideo && (localBlobUrl || fullMediaBlobUrl)) || previewBlobUrl || pictogramBlobUrl;
  const thumbDataUri = useBlurSync(!bestImageData && message && getMessageMediaThumbDataUri(message));
  if (!bestImageData && origin !== MediaViewerOrigin.SearchResult) {
    bestImageData = thumbDataUri;
  }
  if (isVideoAvatar && previewBlobUrl) {
    bestImageData = previewBlobUrl;
  }
  const bestData = localBlobUrl || fullMediaBlobUrl || (
    !isVideo ? previewBlobUrl || pictogramBlobUrl || bestImageData : undefined
  );
  const isLocal = Boolean(localBlobUrl);
  const fileName = message
    ? getMessageFileName(message)
    : avatarOwner
      ? `avatar${avatarOwner!.id}.${avatarOwner?.hasVideoAvatar ? 'mp4' : 'jpg'}`
      : undefined;

  const dimensions = useMemo(() => {
    if (message) {
      if (isDocumentPhoto || isDocumentVideo) {
        return getMessageDocument(message)!.mediaSize!;
      } else if (photo || webPagePhoto || actionPhoto) {
        return getPhotoFullDimensions((photo || webPagePhoto || actionPhoto)!)!;
      } else if (video || webPageVideo) {
        return getVideoDimensions((video || webPageVideo)!)!;
      }
    } else {
      return isVideoAvatar ? VIDEO_AVATAR_FULL_DIMENSIONS : AVATAR_FULL_DIMENSIONS;
    }
    return undefined;
  }, [
    isDocumentPhoto,
    isDocumentVideo,
    isVideoAvatar,
    message,
    photo,
    video,
    actionPhoto,
    webPagePhoto,
    webPageVideo,
  ]);

  return {
    getMediaHash,
    photo,
    video,
    webPagePhoto,
    actionPhoto,
    webPageVideo,
    isVideo,
    isPhoto,
    isGif,
    isDocumentPhoto,
    isDocumentVideo,
    fileName,
    bestImageData,
    bestData,
    dimensions,
    isFromSharedMedia,
    avatarPhoto: avatarMedia,
    isVideoAvatar,
    isLocal,
    loadProgress,
    videoSize,
  };
};
