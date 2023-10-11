import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type {
  ApiDimensions, ApiMessage, ApiPeer,
} from '../../api/types';
import { MediaViewerOrigin } from '../../types';

import {
  selectChat, selectChatMessage, selectIsMessageProtected, selectScheduledMessage, selectTabState, selectUser,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import stopEvent from '../../util/stopEvent';
import { ARE_WEBCODECS_SUPPORTED, IS_TOUCH_ENV } from '../../util/windowEnvironment';
import { calculateMediaViewerDimensions } from '../common/helpers/mediaDimensions';
import { renderMessageText } from '../common/helpers/renderMessageText';

import useAppLayout from '../../hooks/useAppLayout';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useControlsSignal from './hooks/useControlsSignal';
import { useMediaProps } from './hooks/useMediaProps';

import Spinner from '../ui/Spinner';
import MediaViewerFooter from './MediaViewerFooter';
import VideoPlayer from './VideoPlayer';

import './MediaViewerContent.scss';

type OwnProps = {
  mediaId?: number;
  chatId?: string;
  threadId?: number;
  avatarOwnerId?: string;
  origin?: MediaViewerOrigin;
  isActive?: boolean;
  withAnimation?: boolean;
  onClose: () => void;
  onFooterClick: () => void;
  isMoving?: boolean;
};

type StateProps = {
  chatId?: string;
  mediaId?: number;
  senderId?: string;
  threadId?: number;
  avatarOwner?: ApiPeer;
  message?: ApiMessage;
  origin?: MediaViewerOrigin;
  isProtected?: boolean;
  volume: number;
  isMuted: boolean;
  isHidden?: boolean;
  playbackRate: number;
};

const ANIMATION_DURATION = 350;
const MOBILE_VERSION_CONTROL_WIDTH = 350;

const MediaViewerContent: FC<OwnProps & StateProps> = (props) => {
  const {
    mediaId,
    isActive,
    avatarOwner,
    chatId,
    message,
    origin,
    withAnimation,
    isProtected,
    volume,
    playbackRate,
    isMuted,
    isHidden,
    onClose,
    onFooterClick,
    isMoving,
  } = props;

  const lang = useLang();

  const {
    isVideo,
    isPhoto,
    actionPhoto,
    bestImageData,
    bestData,
    dimensions,
    isGif,
    isLocal,
    isVideoAvatar,
    videoSize,
    loadProgress,
  } = useMediaProps({
    message, avatarOwner, mediaId, origin, delay: withAnimation ? ANIMATION_DURATION : false,
  });

  const [, toggleControls] = useControlsSignal();

  const isOpen = Boolean(avatarOwner || mediaId);
  const { isMobile } = useAppLayout();

  const toggleControlsOnMove = useLastCallback(() => {
    toggleControls(true);
  });

  if (avatarOwner || actionPhoto) {
    if (!isVideoAvatar) {
      return (
        <div key={chatId} className="MediaViewerContent">
          {renderPhoto(
            bestData,
            calculateMediaViewerDimensions(dimensions!, false),
            !isMobile && !isProtected,
            isProtected,
          )}
        </div>
      );
    } else {
      return (
        <div key={chatId} className="MediaViewerContent">
          <VideoPlayer
            key={mediaId}
            url={bestData}
            isGif
            posterData={bestImageData}
            posterSize={calculateMediaViewerDimensions(dimensions!, false, true)}
            loadProgress={loadProgress}
            fileSize={videoSize!}
            isMediaViewerOpen={isOpen && isActive}
            isProtected={isProtected}
            isPreviewDisabled={!ARE_WEBCODECS_SUPPORTED || isLocal}
            noPlay={!isActive}
            onClose={onClose}
            isMuted
            shouldCloseOnClick
            volume={0}
            isClickDisabled={isMoving}
            playbackRate={1}
          />
        </div>
      );
    }
  }

  if (!message) return undefined;
  const textParts = message.content.action?.type === 'suggestProfilePhoto'
    ? lang('Conversation.SuggestedPhotoTitle')
    : renderMessageText({ message, forcePlayback: true, isForMediaViewer: true });

  const hasFooter = Boolean(textParts);
  const posterSize = message && calculateMediaViewerDimensions(dimensions!, hasFooter, isVideo);
  const isForceMobileVersion = isMobile || shouldForceMobileVersion(posterSize);

  return (
    <div
      className={buildClassName('MediaViewerContent', hasFooter && 'has-footer')}
      onMouseMove={isForceMobileVersion && !IS_TOUCH_ENV ? toggleControlsOnMove : undefined}
    >
      {isPhoto && renderPhoto(
        bestData,
        posterSize,
        !isMobile && !isProtected,
        isProtected,
      )}
      {isVideo && (!isActive ? renderVideoPreview(
        bestImageData,
        posterSize,
        !isMobile && !isProtected,
        isProtected,
      ) : (
        <VideoPlayer
          key={mediaId}
          url={bestData}
          isGif={isGif}
          posterData={bestImageData}
          posterSize={posterSize}
          loadProgress={loadProgress}
          fileSize={videoSize!}
          isMediaViewerOpen={isOpen && isActive}
          noPlay={!isActive}
          isPreviewDisabled={!ARE_WEBCODECS_SUPPORTED || isLocal}
          onClose={onClose}
          isMuted={isMuted}
          isHidden={isHidden}
          isForceMobileVersion={isForceMobileVersion}
          isProtected={isProtected}
          volume={volume}
          isClickDisabled={isMoving}
          playbackRate={playbackRate}
        />
      ))}
      {textParts && (
        <MediaViewerFooter
          text={textParts}
          onClick={onFooterClick}
          isProtected={isProtected}
          isForceMobileVersion={isForceMobileVersion}
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
      mediaId,
      avatarOwnerId,
      origin,
    } = ownProps;

    const {
      volume,
      isMuted,
      playbackRate,
      isHidden,
    } = selectTabState(global).mediaViewer;

    if (origin === MediaViewerOrigin.SearchResult) {
      if (!(chatId && mediaId)) {
        return { volume, isMuted, playbackRate };
      }

      const message = selectChatMessage(global, chatId, mediaId);
      if (!message) {
        return { volume, isMuted, playbackRate };
      }

      return {
        chatId,
        mediaId,
        senderId: message.senderId,
        origin,
        message,
        isProtected: selectIsMessageProtected(global, message),
        volume,
        isMuted,
        isHidden,
        playbackRate,
      };
    }

    if (avatarOwnerId) {
      const sender = selectUser(global, avatarOwnerId) || selectChat(global, avatarOwnerId);

      return {
        mediaId,
        senderId: avatarOwnerId,
        avatarOwner: sender,
        origin,
        volume,
        isMuted,
        isHidden,
        playbackRate,
      };
    }

    if (!(chatId && threadId && mediaId)) {
      return { volume, isMuted, playbackRate };
    }

    let message: ApiMessage | undefined;
    if (origin && [MediaViewerOrigin.ScheduledAlbum, MediaViewerOrigin.ScheduledInline].includes(origin)) {
      message = selectScheduledMessage(global, chatId, mediaId);
    } else {
      message = selectChatMessage(global, chatId, mediaId);
    }

    if (!message) {
      return { volume, isMuted, playbackRate };
    }

    return {
      chatId,
      threadId,
      mediaId,
      senderId: message.senderId,
      origin,
      message,
      isProtected: selectIsMessageProtected(global, message),
      volume,
      isMuted,
      isHidden,
      playbackRate,
    };
  },
)(MediaViewerContent));

function renderPhoto(blobUrl?: string, imageSize?: ApiDimensions, canDrag?: boolean, isProtected?: boolean) {
  return blobUrl
    ? (
      <div style="position: relative;">
        {isProtected && <div onContextMenu={stopEvent} className="protector" />}
        <img
          src={blobUrl}
          alt=""
          className={buildClassName(isProtected && 'is-protected')}
          style={imageSize ? `width: ${imageSize.width}px` : ''}
          draggable={Boolean(canDrag)}
        />
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

function renderVideoPreview(blobUrl?: string, imageSize?: ApiDimensions, canDrag?: boolean, isProtected?: boolean) {
  const wrapperStyle = imageSize && `width: ${imageSize.width}px; height: ${imageSize.height}px`;
  const videoStyle = `background-image: url(${blobUrl})`;
  return blobUrl
    ? (
      <div
        className="VideoPlayer"
      >
        {isProtected && <div onContextMenu={stopEvent} className="protector" />}
        <div
          style={wrapperStyle}
        >
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            style={videoStyle}
            className={buildClassName(isProtected && 'is-protected')}
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

function shouldForceMobileVersion(posterSize?: { width: number; height: number }) {
  if (!posterSize) return false;
  return posterSize.width < MOBILE_VERSION_CONTROL_WIDTH;
}
