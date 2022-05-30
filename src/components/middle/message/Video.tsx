import type { FC } from '../../../lib/teact/teact';
import React, { useCallback, useRef, useState } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMessage } from '../../../api/types';
import { ApiMediaFormat } from '../../../api/types';
import type { IMediaDimensions } from './helpers/calculateAlbumLayout';

import { formatMediaDuration } from '../../../util/dateFormat';
import buildClassName from '../../../util/buildClassName';
import { calculateVideoDimensions } from '../../common/helpers/mediaDimensions';
import {
  getMediaTransferState,
  getMessageMediaFormat,
  getMessageMediaHash,
  getMessageVideo,
  getMessageWebPageVideo,
  isForwardedMessage,
  isOwnMessage,
} from '../../../global/helpers';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useMediaWithLoadProgress from '../../../hooks/useMediaWithLoadProgress';
import useMedia from '../../../hooks/useMedia';
import useShowTransition from '../../../hooks/useShowTransition';
import usePrevious from '../../../hooks/usePrevious';
import useBuffering from '../../../hooks/useBuffering';
import useVideoCleanup from '../../../hooks/useVideoCleanup';
import useMediaTransition from '../../../hooks/useMediaTransition';
import useVideoAutoPause from './hooks/useVideoAutoPause';
import useBlurredMediaThumbRef from './hooks/useBlurredMediaThumbRef';

import ProgressSpinner from '../../ui/ProgressSpinner';

export type OwnProps = {
  id?: string;
  message: ApiMessage;
  observeIntersection: ObserveFn;
  noAvatars?: boolean;
  canAutoLoad?: boolean;
  canAutoPlay?: boolean;
  uploadProgress?: number;
  dimensions?: IMediaDimensions;
  lastSyncTime?: number;
  isDownloading: boolean;
  isProtected?: boolean;
  withAspectRatio?: boolean;
  onClick?: (id: number) => void;
  onCancelUpload?: (message: ApiMessage) => void;
};

const Video: FC<OwnProps> = ({
  id,
  message,
  observeIntersection,
  noAvatars,
  canAutoLoad,
  canAutoPlay,
  uploadProgress,
  lastSyncTime,
  dimensions,
  onClick,
  onCancelUpload,
  isDownloading,
  isProtected,
  withAspectRatio,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const videoRef = useRef<HTMLVideoElement>(null);

  const video = (getMessageVideo(message) || getMessageWebPageVideo(message))!;
  const localBlobUrl = video.blobUrl;

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const [isLoadAllowed, setIsLoadAllowed] = useState(canAutoLoad);
  const shouldLoad = Boolean(isLoadAllowed && isIntersecting && lastSyncTime);
  const [isPlayAllowed, setIsPlayAllowed] = useState(canAutoPlay);

  const previewBlobUrl = useMedia(
    getMessageMediaHash(message, 'pictogram'),
    !(isIntersecting && lastSyncTime),
    getMessageMediaFormat(message, 'pictogram'),
    lastSyncTime,
  );
  const previewClassNames = useMediaTransition(previewBlobUrl);

  const { mediaData, loadProgress } = useMediaWithLoadProgress(
    getMessageMediaHash(message, 'inline'),
    !shouldLoad,
    getMessageMediaFormat(message, 'inline'),
    lastSyncTime,
  );
  const fullMediaData = localBlobUrl || mediaData;
  const isInline = Boolean(isIntersecting && fullMediaData);
  // Thumbnail is always rendered so we can only disable blur if we have preview
  const thumbRef = useBlurredMediaThumbRef(message, previewBlobUrl);

  const { loadProgress: downloadProgress } = useMediaWithLoadProgress(
    getMessageMediaHash(message, 'download'),
    !isDownloading,
    ApiMediaFormat.BlobUrl,
    lastSyncTime,
  );

  const { isBuffered, bufferingHandlers } = useBuffering(!canAutoLoad);
  const { isUploading, isTransferring, transferProgress } = getMediaTransferState(
    message,
    uploadProgress || (isDownloading ? downloadProgress : loadProgress),
    (shouldLoad && !isBuffered) || isDownloading,
  );
  const wasLoadDisabled = usePrevious(isLoadAllowed) === false;
  const {
    shouldRender: shouldRenderSpinner,
    transitionClassNames: spinnerClassNames,
  } = useShowTransition(isTransferring, undefined, wasLoadDisabled);
  const {
    shouldRender: shouldRenderPlayButton,
    transitionClassNames: playButtonClassNames,
  } = useShowTransition(isLoadAllowed && !isPlayAllowed && !shouldRenderSpinner);

  const [playProgress, setPlayProgress] = useState<number>(0);
  const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    setPlayProgress(Math.max(0, e.currentTarget.currentTime - 1));
  }, []);

  const duration = (videoRef.current?.duration) || video.duration || 0;

  const isOwn = isOwnMessage(message);
  const isForwarded = isForwardedMessage(message);
  const { width, height } = dimensions || calculateVideoDimensions(video, isOwn, isForwarded, noAvatars);

  useVideoAutoPause(videoRef, isInline);
  useVideoCleanup(videoRef, [isInline]);

  const handleClick = useCallback(() => {
    if (isUploading) {
      if (onCancelUpload) {
        onCancelUpload(message);
      }
    } else if (isDownloading) {
      getActions().cancelMessageMediaDownload({ message });
    } else if (!fullMediaData) {
      setIsLoadAllowed((isAllowed) => !isAllowed);
    } else if (fullMediaData && !isPlayAllowed) {
      setIsPlayAllowed(true);
      videoRef.current!.play();
    } else if (onClick) {
      onClick(message.id);
    }
  }, [isUploading, isDownloading, fullMediaData, isPlayAllowed, onClick, onCancelUpload, message]);

  const className = buildClassName('media-inner dark', !isUploading && 'interactive');
  const aspectRatio = withAspectRatio ? `aspect-ratio: ${(width / height).toFixed(3)}/ 1` : '';
  const style = dimensions
    ? `width: ${width}px; height: ${height}px; left: ${dimensions.x}px; top: ${dimensions.y}px;${aspectRatio}`
    : '';
  return (
    <div
      ref={ref}
      id={id}
      className={className}
      style={style}
      onClick={isUploading ? undefined : handleClick}
    >
      <canvas
        ref={thumbRef}
        className="thumbnail"
        style={`width: ${width}px; height: ${height}px;${aspectRatio}`}
      />
      <img
        src={previewBlobUrl}
        className={buildClassName('thumbnail', previewClassNames)}
        style={`width: ${width}px; height: ${height}px;${aspectRatio}`}
        alt=""
        draggable={!isProtected}
      />
      {isInline && (
        <video
          ref={videoRef}
          className="full-media"
          width={width}
          height={height}
          autoPlay={isPlayAllowed}
          muted
          loop
          playsInline
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...bufferingHandlers}
          draggable={!isProtected}
          onTimeUpdate={handleTimeUpdate}
          style={aspectRatio}
        >
          <source src={fullMediaData} />
        </video>
      )}
      {isProtected && <span className="protector" />}
      {shouldRenderPlayButton && <i className={buildClassName('icon-large-play', playButtonClassNames)} />}
      {shouldRenderSpinner && (
        <div className={buildClassName('media-loading', spinnerClassNames)}>
          <ProgressSpinner progress={transferProgress} onClick={handleClick} />
        </div>
      )}
      {!isLoadAllowed && (
        <i className="icon-download" />
      )}
      {isTransferring ? (
        <span className="message-transfer-progress">
          {(isUploading || isDownloading) ? `${Math.round(transferProgress * 100)}%` : '...'}
        </span>
      ) : (
        <div className="message-media-duration">
          {video.isGif ? 'GIF' : formatMediaDuration(Math.max(duration - playProgress, 0))}
        </div>
      )}
    </div>
  );
};

export default Video;
