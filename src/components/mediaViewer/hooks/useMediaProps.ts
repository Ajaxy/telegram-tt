import type {
  ApiMessage, ApiChat, ApiUser, ApiDimensions,
} from '../../../api/types';
import { ApiMediaFormat } from '../../../api/types';
import {
  getVideoAvatarMediaHash,
  getChatAvatarHash,
  getMessageMediaHash,
  getMessagePhoto,
  getMessageVideo,
  getMessageWebPagePhoto,
  getMessageWebPageVideo,
  isMessageDocumentPhoto,
  isMessageDocumentVideo,
  getMessageMediaFormat,
  getMessageMediaThumbDataUri,
  getMessageFileName,
  getMessageDocument,
  getPhotoFullDimensions,
  getVideoDimensions,
  getMessageFileSize,
} from '../../../global/helpers';
import { useMemo } from '../../../lib/teact/teact';
import useMedia from '../../../hooks/useMedia';
import useMediaWithLoadProgress from '../../../hooks/useMediaWithLoadProgress';
import useBlurSync from '../../../hooks/useBlurSync';
import { MediaViewerOrigin } from '../../../types';
import { VIDEO_AVATAR_FULL_DIMENSIONS, AVATAR_FULL_DIMENSIONS } from '../../common/helpers/mediaDimensions';

type UseMediaProps = {
  mediaId?: number;
  message?: ApiMessage;
  avatarOwner?: ApiChat | ApiUser;
  origin?: MediaViewerOrigin;
  lastSyncTime?: number;
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
  const video = message ? getMessageVideo(message) : undefined;
  const webPagePhoto = message ? getMessageWebPagePhoto(message) : undefined;
  const webPageVideo = message ? getMessageWebPageVideo(message) : undefined;
  const isDocumentPhoto = message ? isMessageDocumentPhoto(message) : false;
  const isDocumentVideo = message ? isMessageDocumentVideo(message) : false;
  const videoSize = message ? getMessageFileSize(message) : undefined;
  const avatarMedia = avatarOwner?.photos?.[mediaId];
  const isVideoAvatar = Boolean(avatarMedia?.isVideo);
  const isVideo = Boolean(video || webPageVideo || isDocumentVideo);
  const isPhoto = Boolean(!isVideo && (photo || webPagePhoto || isDocumentPhoto));
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
    return message && getMessageMediaHash(message, isFull ? 'full' : 'preview');
  }, [avatarOwner, message, avatarMedia, mediaId]);

  const pictogramBlobUrl = useMedia(
    message && (isFromSharedMedia || isFromSearch) && getMessageMediaHash(message, 'pictogram'),
    undefined,
    ApiMediaFormat.BlobUrl,
    undefined,
    delay,
  );
  const previewMediaHash = getMediaHash();
  const previewBlobUrl = useMedia(
    previewMediaHash,
    undefined,
    ApiMediaFormat.BlobUrl,
    undefined,
    delay,
  );
  const {
    mediaData: fullMediaBlobUrl,
    loadProgress,
  } = useMediaWithLoadProgress(
    getMediaHash(true),
    undefined,
    message && getMessageMediaFormat(message, 'full'),
    undefined,
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

  const fileName = message
    ? getMessageFileName(message)
    : avatarOwner
      ? `avatar${avatarOwner!.id}.${avatarOwner?.hasVideoAvatar ? 'mp4' : 'jpg'}`
      : undefined;

  let dimensions!: ApiDimensions;
  if (message) {
    if (isDocumentPhoto || isDocumentVideo) {
      dimensions = getMessageDocument(message)!.mediaSize!;
    } else if (photo || webPagePhoto) {
      dimensions = getPhotoFullDimensions((photo || webPagePhoto)!)!;
    } else if (video || webPageVideo) {
      dimensions = getVideoDimensions((video || webPageVideo)!)!;
    }
  } else {
    dimensions = isVideoAvatar ? VIDEO_AVATAR_FULL_DIMENSIONS : AVATAR_FULL_DIMENSIONS;
  }

  return {
    getMediaHash,
    photo,
    video,
    webPagePhoto,
    webPageVideo,
    isVideo,
    isPhoto,
    isGif,
    isDocumentPhoto,
    isDocumentVideo,
    fileName,
    bestImageData,
    dimensions,
    isFromSharedMedia,
    avatarPhoto: avatarMedia,
    isVideoAvatar,
    localBlobUrl,
    fullMediaBlobUrl,
    previewBlobUrl,
    pictogramBlobUrl,
    loadProgress,
    videoSize,
  };
};
