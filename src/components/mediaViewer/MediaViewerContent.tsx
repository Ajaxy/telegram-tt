import type { FC } from '../../lib/teact/teact';
import React, { memo, useCallback } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type {
  ApiChat, ApiDimensions, ApiMessage, ApiUser,
} from '../../api/types';
import { ApiMediaFormat } from '../../api/types';
import { MediaViewerOrigin } from '../../types';

import { IS_SINGLE_COLUMN_LAYOUT, IS_TOUCH_ENV } from '../../util/environment';
import useBlurSync from '../../hooks/useBlurSync';
import useMedia from '../../hooks/useMedia';
import useMediaWithLoadProgress from '../../hooks/useMediaWithLoadProgress';
import {
  getChatAvatarHash,
  getMessageDocument,
  getMessageFileSize,
  getMessageMediaFormat,
  getMessageMediaHash,
  getMessageMediaThumbDataUri,
  getMessagePhoto,
  getMessageVideo,
  getMessageWebPagePhoto,
  getMessageWebPageVideo,
  getPhotoFullDimensions,
  getVideoDimensions,
  isMessageDocumentPhoto,
  isMessageDocumentVideo,
} from '../../global/helpers';
import {
  selectChat, selectChatMessage, selectIsMessageProtected, selectScheduledMessage, selectUser,
} from '../../global/selectors';
import { AVATAR_FULL_DIMENSIONS, calculateMediaViewerDimensions } from '../common/helpers/mediaDimensions';
import { renderMessageText } from '../common/helpers/renderMessageText';
import stopEvent from '../../util/stopEvent';

import Spinner from '../ui/Spinner';
import MediaViewerFooter from './MediaViewerFooter';
import VideoPlayer from './VideoPlayer';

import './MediaViewerContent.scss';

type OwnProps = {
  messageId?: number;
  chatId?: string;
  threadId?: number;
  avatarOwnerId?: string;
  profilePhotoIndex?: number;
  origin?: MediaViewerOrigin;
  isActive?: boolean;
  animationLevel: 0 | 1 | 2;
  onClose: () => void;
  onFooterClick: () => void;
  setIsFooterHidden?: (isHidden: boolean) => void;
  isFooterHidden?: boolean;
};

type StateProps = {
  chatId?: string;
  messageId?: number;
  senderId?: string;
  threadId?: number;
  avatarOwner?: ApiChat | ApiUser;
  profilePhotoIndex?: number;
  message?: ApiMessage;
  origin?: MediaViewerOrigin;
  isProtected?: boolean;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
};

const ANIMATION_DURATION = 350;

const MediaViewerContent: FC<OwnProps & StateProps> = (props) => {
  const {
    messageId,
    isActive,
    avatarOwner,
    chatId,
    message,
    profilePhotoIndex,
    origin,
    animationLevel,
    isFooterHidden,
    isProtected,
    volume,
    playbackRate,
    isMuted,
    onClose,
    onFooterClick,
    setIsFooterHidden,
  } = props;
  /* Content */
  const photo = message ? getMessagePhoto(message) : undefined;
  const video = message ? getMessageVideo(message) : undefined;
  const webPagePhoto = message ? getMessageWebPagePhoto(message) : undefined;
  const webPageVideo = message ? getMessageWebPageVideo(message) : undefined;
  const isDocumentPhoto = message ? isMessageDocumentPhoto(message) : false;
  const isDocumentVideo = message ? isMessageDocumentVideo(message) : false;
  const isVideo = Boolean(video || webPageVideo || isDocumentVideo);
  const isPhoto = Boolean(!isVideo && (photo || webPagePhoto || isDocumentPhoto));
  const { isGif } = video || webPageVideo || {};

  const isOpen = Boolean(avatarOwner || messageId);
  const isAvatar = Boolean(avatarOwner);

  const isFromSharedMedia = origin === MediaViewerOrigin.SharedMedia;
  const isFromSearch = origin === MediaViewerOrigin.SearchResult;

  const isGhostAnimation = animationLevel === 2;

  /* Media data */
  function getMediaHash(isFull?: boolean) {
    if (isAvatar && profilePhotoIndex !== undefined) {
      const { photos } = avatarOwner!;
      return photos && photos[profilePhotoIndex]
        ? `photo${photos[profilePhotoIndex].id}?size=c`
        : getChatAvatarHash(avatarOwner!, isFull ? 'big' : 'normal');
    }

    return message && getMessageMediaHash(message, isFull ? 'viewerFull' : 'viewerPreview');
  }

  const pictogramBlobUrl = useMedia(
    message && (isFromSharedMedia || isFromSearch) && getMessageMediaHash(message, 'pictogram'),
    undefined,
    ApiMediaFormat.BlobUrl,
    undefined,
    isGhostAnimation && ANIMATION_DURATION,
  );
  const previewMediaHash = getMediaHash();
  const previewBlobUrl = useMedia(
    previewMediaHash,
    undefined,
    ApiMediaFormat.BlobUrl,
    undefined,
    isGhostAnimation && ANIMATION_DURATION,
  );
  const {
    mediaData: fullMediaBlobUrl,
    loadProgress,
  } = useMediaWithLoadProgress(
    getMediaHash(true),
    undefined,
    message && getMessageMediaFormat(message, 'viewerFull'),
    undefined,
    isGhostAnimation && ANIMATION_DURATION,
  );

  const toggleControls = useCallback((isVisible) => {
    setIsFooterHidden?.(!isVisible);
  }, [setIsFooterHidden]);

  const localBlobUrl = (photo || video) ? (photo || video)!.blobUrl : undefined;
  let bestImageData = (!isVideo && (localBlobUrl || fullMediaBlobUrl)) || previewBlobUrl || pictogramBlobUrl;
  const thumbDataUri = useBlurSync(!bestImageData && message && getMessageMediaThumbDataUri(message));
  if (!bestImageData && origin !== MediaViewerOrigin.SearchResult) {
    bestImageData = thumbDataUri;
  }

  const videoSize = message ? getMessageFileSize(message) : undefined;

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
    dimensions = AVATAR_FULL_DIMENSIONS;
  }

  if (isAvatar) {
    return (
      <div key={chatId} className="MediaViewerContent">
        {renderPhoto(
          fullMediaBlobUrl || previewBlobUrl,
          calculateMediaViewerDimensions(AVATAR_FULL_DIMENSIONS, false),
          !IS_SINGLE_COLUMN_LAYOUT && !isProtected,
        )}
      </div>
    );
  }

  if (!message) return undefined;
  const textParts = renderMessageText(message);
  const hasFooter = Boolean(textParts);

  return (
    <div
      className={`MediaViewerContent ${hasFooter ? 'has-footer' : ''}`}
    >
      {isProtected && <div onContextMenu={stopEvent} className="protector" />}
      {isPhoto && renderPhoto(
        localBlobUrl || fullMediaBlobUrl || previewBlobUrl || pictogramBlobUrl,
        message && calculateMediaViewerDimensions(dimensions!, hasFooter),
        !IS_SINGLE_COLUMN_LAYOUT && !isProtected,
      )}
      {isVideo && ((!isActive && IS_TOUCH_ENV) ? renderVideoPreview(
        bestImageData,
        message && calculateMediaViewerDimensions(dimensions!, hasFooter, true),
        !IS_SINGLE_COLUMN_LAYOUT && !isProtected,
      ) : (
        <VideoPlayer
          key={messageId}
          url={localBlobUrl || fullMediaBlobUrl}
          isGif={isGif}
          posterData={bestImageData}
          posterSize={message && calculateMediaViewerDimensions(dimensions!, hasFooter, true)}
          loadProgress={loadProgress}
          fileSize={videoSize!}
          isMediaViewerOpen={isOpen && isActive}
          areControlsVisible={!isFooterHidden}
          toggleControls={toggleControls}
          noPlay={!isActive}
          onClose={onClose}
          isMuted={isMuted}
          volume={volume}
          playbackRate={playbackRate}
        />
      ))}
      {textParts && (
        <MediaViewerFooter
          text={textParts}
          onClick={onFooterClick}
          isHidden={isFooterHidden}
          isForVideo={isVideo && !isGif}
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, ownProps): StateProps => {
    const {
      chatId,
      threadId,
      messageId,
      avatarOwnerId,
      profilePhotoIndex,
      origin,
    } = ownProps;

    const {
      volume,
      isMuted,
      playbackRate,
    } = global.mediaViewer;

    if (origin === MediaViewerOrigin.SearchResult) {
      if (!(chatId && messageId)) {
        return { volume, isMuted, playbackRate };
      }

      const message = selectChatMessage(global, chatId, messageId);
      if (!message) {
        return { volume, isMuted, playbackRate };
      }

      return {
        chatId,
        messageId,
        senderId: message.senderId,
        origin,
        message,
        isProtected: selectIsMessageProtected(global, message),
        volume,
        isMuted,
        playbackRate,
      };
    }

    if (avatarOwnerId) {
      const sender = selectUser(global, avatarOwnerId) || selectChat(global, avatarOwnerId);

      return {
        messageId: -1,
        senderId: avatarOwnerId,
        avatarOwner: sender,
        profilePhotoIndex: profilePhotoIndex || 0,
        origin,
        volume,
        isMuted,
        playbackRate,
      };
    }

    if (!(chatId && threadId && messageId)) {
      return { volume, isMuted, playbackRate };
    }

    let message: ApiMessage | undefined;
    if (origin && [MediaViewerOrigin.ScheduledAlbum, MediaViewerOrigin.ScheduledInline].includes(origin)) {
      message = selectScheduledMessage(global, chatId, messageId);
    } else {
      message = selectChatMessage(global, chatId, messageId);
    }

    if (!message) {
      return { volume, isMuted, playbackRate };
    }

    return {
      chatId,
      threadId,
      messageId,
      senderId: message.senderId,
      origin,
      message,
      isProtected: selectIsMessageProtected(global, message),
      volume,
      isMuted,
      playbackRate,
    };
  },
)(MediaViewerContent));

function renderPhoto(blobUrl?: string, imageSize?: ApiDimensions, canDrag?: boolean) {
  return blobUrl
    ? (
      <img
        src={blobUrl}
        alt=""
        style={imageSize ? `width: ${imageSize.width}px` : ''}
        draggable={Boolean(canDrag)}
      />
    )
    : (
      <div
        className="spinner-wrapper"
        style={imageSize ? `width: ${imageSize.width}px` : ''}
      >
        <Spinner color="white" />
      </div>
    );
}

function renderVideoPreview(blobUrl?: string, imageSize?: ApiDimensions, canDrag?: boolean) {
  const wrapperStyle = imageSize && `width: ${imageSize.width}px; height: ${imageSize.height}px`;
  const videoStyle = `background-image: url(${blobUrl})`;
  return blobUrl
    ? (
      <div
        className="VideoPlayer"
      >
        <div
          style={wrapperStyle}
        >
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            style={videoStyle}
            draggable={Boolean(canDrag)}
          />
        </div>
      </div>
    )
    : (
      <div
        className="spinner-wrapper"
        style={imageSize ? `width: ${imageSize.width}px` : ''}
      >
        <Spinner color="white" />
      </div>
    );
}
