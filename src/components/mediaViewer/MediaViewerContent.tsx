import type React from '../../lib/teact/teact';
import { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiDimensions, ApiMessage, ApiSponsoredMessage,
} from '../../api/types';
import type { MediaViewerOrigin, ThreadId } from '../../types';
import type { MediaViewerItem, ViewableMedia } from './helpers/getViewableMedia';

import { MEDIA_TIMESTAMP_SAVE_MINIMUM_DURATION } from '../../config';
import {
  selectIsMessageProtected, selectTabState,
} from '../../global/selectors';
import { selectMessageTimestampableDuration } from '../../global/selectors/media';
import { IS_TOUCH_ENV } from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';
import stopEvent from '../../util/stopEvent';
import { calculateMediaViewerDimensions } from '../common/helpers/mediaDimensions';
import { renderMessageText } from '../common/helpers/renderMessageText';
import selectViewableMedia from './helpers/getViewableMedia';

import useAppLayout from '../../hooks/useAppLayout';
import useCurrentTimeSignal from '../../hooks/useCurrentTimeSignal';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import { useSignalEffect } from '../../hooks/useSignalEffect';
import useThrottledCallback from '../../hooks/useThrottledCallback';
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
  onFooterClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleSponsoredClick: () => void;
};

type StateProps = {
  viewableMedia?: ViewableMedia;
  textMessage?: ApiMessage | ApiSponsoredMessage;
  origin?: MediaViewerOrigin;
  isProtected?: boolean;
  volume: number;
  isMuted: boolean;
  isHidden?: boolean;
  playbackRate: number;
  threadId?: ThreadId;
  timestamp?: number;
  maxTimestamp?: number;
};

const ANIMATION_DURATION = 350;
const MOBILE_VERSION_CONTROL_WIDTH = 350;
const PLAYBACK_SAVE_INTERVAL = 1000;

const MediaViewerContent = ({
  item,
  viewableMedia,
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
  threadId,
  timestamp,
  maxTimestamp,
  onClose,
  onFooterClick,
  handleSponsoredClick,
}: OwnProps & StateProps) => {
  const { updateLastPlaybackTimestamp } = getActions();

  const lang = useOldLang();

  const isAvatar = item.type === 'avatar';
  const isSponsoredMessage = item.type === 'sponsoredMessage';
  const { media } = viewableMedia || {};

  const {
    isVideo,
    isPhoto,
    bestImageData,
    bestData,
    dimensions,
    isGif,
    isVideoAvatar,
    mediaSize,
    loadProgress,
  } = useMediaProps({
    media, isAvatar, origin, delay: withAnimation ? ANIMATION_DURATION : false,
  });

  const [, toggleControls] = useControlsSignal();
  const [getCurrentTime] = useCurrentTimeSignal();

  const isOpen = Boolean(media);
  const { isMobile } = useAppLayout();

  const toggleControlsOnMove = useLastCallback(() => {
    toggleControls(true);
  });

  const updatePlaybackTimestamp = useThrottledCallback(() => {
    if (!isActive || !textMessage || media?.mediaType !== 'video') return;
    if (media.duration < MEDIA_TIMESTAMP_SAVE_MINIMUM_DURATION) return;

    const message = 'id' in textMessage ? textMessage : undefined;
    const currentTime = getCurrentTime();
    if (!currentTime || !message || message.isInAlbum) return;

    // Reset timestamp if we are close to the end of the video
    const newTimestamp = media.duration - currentTime > PLAYBACK_SAVE_INTERVAL / 1000 ? currentTime : undefined;
    updateLastPlaybackTimestamp({ chatId: message.chatId, messageId: message.id, timestamp: newTimestamp });
  }, [getCurrentTime, isActive, media, textMessage], PLAYBACK_SAVE_INTERVAL);

  useSignalEffect(updatePlaybackTimestamp, [getCurrentTime]);

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
            noPlay={!isActive}
            onClose={onClose}
            isMuted
            shouldCloseOnClick
            volume={0}
            isClickDisabled={isMoving}
            playbackRate={1}
            isSponsoredMessage={isSponsoredMessage}
            handleSponsoredClick={handleSponsoredClick}
          />
        </div>
      );
    }
  }

  const textParts = textMessage && (
    textMessage.content.action
      ? (textMessage.content.action.type === 'suggestProfilePhoto'
        ? lang('Conversation.SuggestedPhotoTitle') : undefined)
      : renderMessageText({
        message: textMessage, maxTimestamp, threadId, forcePlayback: true, isForMediaViewer: true,
      }));
  const buttonText = textMessage && 'buttonText' in textMessage ? textMessage.buttonText : undefined;
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
          storyboardInfo={'storyboardInfo' in media ? media.storyboardInfo : undefined}
          isGif={isGif}
          posterData={bestImageData}
          posterSize={posterSize}
          loadProgress={loadProgress}
          fileSize={mediaSize!}
          isMediaViewerOpen={isOpen && isActive}
          noPlay={!isActive}
          onClose={onClose}
          isMuted={isMuted}
          isHidden={isHidden}
          isForceMobileVersion={isForceMobileVersion}
          isProtected={isProtected}
          volume={volume}
          isClickDisabled={isMoving}
          playbackRate={playbackRate}
          isSponsoredMessage={isSponsoredMessage}
          handleSponsoredClick={handleSponsoredClick}
          timestamp={timestamp}
        />
      ))}
      {textParts && (
        <MediaViewerFooter
          text={textParts}
          buttonText={buttonText}
          onClick={onFooterClick}
          isProtected={isProtected}
          isForceMobileVersion={isForceMobileVersion}
          isForVideo={isVideo && !isGif}
          handleSponsoredClick={handleSponsoredClick}
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { item }): Complete<StateProps> => {
    const {
      volume,
      isMuted,
      playbackRate,
      isHidden,
      origin,
      timestamp,
      threadId,
    } = selectTabState(global).mediaViewer;
    const message = item.type === 'message' ? item.message : undefined;
    const sponsoredMessage = item.type === 'sponsoredMessage' ? item.message : undefined;
    const textMessage = message || sponsoredMessage;
    const viewableMedia = selectViewableMedia(global, origin, item);

    const maxTimestamp = message && selectMessageTimestampableDuration(global, message, true);

    return {
      origin,
      textMessage,
      isProtected: message && selectIsMessageProtected(global, message),
      volume,
      isMuted,
      isHidden,
      playbackRate,
      threadId,
      timestamp,
      maxTimestamp,
      viewableMedia,
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
