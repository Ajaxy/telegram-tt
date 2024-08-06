import React, { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type {
  ApiDimensions, ApiMessage,
} from '../../api/types';
import type { MediaViewerOrigin } from '../../types';
import type { MediaViewerItem } from './helpers/getViewableMedia';

import {
  selectIsMessageProtected, selectTabState,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import stopEvent from '../../util/stopEvent';
import { ARE_WEBCODECS_SUPPORTED, IS_TOUCH_ENV } from '../../util/windowEnvironment';
import { calculateMediaViewerDimensions } from '../common/helpers/mediaDimensions';
import { renderMessageText } from '../common/helpers/renderMessageText';
import getViewableMedia from './helpers/getViewableMedia';

import useAppLayout from '../../hooks/useAppLayout';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import useControlsSignal from './hooks/useControlsSignal';
import { useMediaProps } from './hooks/useMediaProps';

import Spinner from '../ui/Spinner';
import MediaViewerFooter from './MediaViewerFooter';
import VideoPlayer from './VideoPlayer';

import './MediaViewerContent.scss';

type OwnProps = {
  item: MediaViewerItem;
  isActive?: boolean;
  withAnimation?: boolean;
  isMoving?: boolean;
  onClose: () => void;
  onFooterClick: () => void;
};

type StateProps = {
  textMessage?: ApiMessage;
  origin?: MediaViewerOrigin;
  isProtected?: boolean;
  volume: number;
  isMuted: boolean;
  isHidden?: boolean;
  playbackRate: number;
};

const ANIMATION_DURATION = 350;
const MOBILE_VERSION_CONTROL_WIDTH = 350;

const MediaViewerContent = ({
  item,
  isActive,
  textMessage,
  origin,
  withAnimation,
  isProtected,
  volume,
  playbackRate,
  isMuted,
  isHidden,
  isMoving,
  onClose,
  onFooterClick,
}: OwnProps & StateProps) => {
  const lang = useOldLang();

  const isAvatar = item.type === 'avatar';
  const { media } = getViewableMedia(item) || {};

  const {
    isVideo,
    isPhoto,
    bestImageData,
    bestData,
    dimensions,
    isGif,
    isLocal,
    isVideoAvatar,
    mediaSize,
    loadProgress,
  } = useMediaProps({
    media, isAvatar, origin, delay: withAnimation ? ANIMATION_DURATION : false,
  });

  const [, toggleControls] = useControlsSignal();

  const isOpen = Boolean(media);
  const { isMobile } = useAppLayout();

  const toggleControlsOnMove = useLastCallback(() => {
    toggleControls(true);
  });

  if (!media) return undefined;

  if (item.type === 'avatar') {
    if (!isVideoAvatar) {
      return (
        <div key={media.id} className="MediaViewerContent">
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
        <div key={media.id} className="MediaViewerContent">
          <VideoPlayer
            key={media.id}
            url={bestData}
            isGif
            posterData={bestImageData}
            posterSize={calculateMediaViewerDimensions(dimensions!, false, true)}
            loadProgress={loadProgress}
            fileSize={mediaSize!}
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

  const textParts = textMessage && (textMessage.content.action?.type === 'suggestProfilePhoto'
    ? lang('Conversation.SuggestedPhotoTitle')
    : renderMessageText({ message: textMessage, forcePlayback: true, isForMediaViewer: true }));

  const hasFooter = Boolean(textParts);
  const posterSize = calculateMediaViewerDimensions(dimensions!, hasFooter, isVideo);
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
          key={media.id}
          url={bestData}
          isGif={isGif}
          posterData={bestImageData}
          posterSize={posterSize}
          loadProgress={loadProgress}
          fileSize={mediaSize!}
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
  (global, { item }): StateProps => {
    const {
      volume,
      isMuted,
      playbackRate,
      isHidden,
      origin,
    } = selectTabState(global).mediaViewer;
    const textMessage = item.type === 'message' ? item.message : undefined;

    return {
      origin,
      textMessage,
      isProtected: textMessage && selectIsMessageProtected(global, textMessage),
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
