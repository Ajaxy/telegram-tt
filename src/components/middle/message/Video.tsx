import React, {
  FC, useCallback, useRef, useState,
} from '../../../lib/teact/teact';

import { ApiMessage } from '../../../api/types';
import { IMediaDimensions } from './helpers/calculateAlbumLayout';

import { formatMediaDuration } from '../../../util/dateFormat';
import buildClassName from '../../../util/buildClassName';
import { calculateVideoDimensions } from '../../common/helpers/mediaDimensions';
import {
  canMessagePlayVideoInline,
  getMediaTransferState,
  getMessageMediaFormat,
  getMessageMediaHash,
  isForwardedMessage,
  isOwnMessage,
} from '../../../modules/helpers';
import { ObserveFn, useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useMediaWithDownloadProgress from '../../../hooks/useMediaWithDownloadProgress';
import useMedia from '../../../hooks/useMedia';
import useShowTransition from '../../../hooks/useShowTransition';
import useTransitionForMedia from '../../../hooks/useTransitionForMedia';
import usePrevious from '../../../hooks/usePrevious';
import useBuffering from '../../../hooks/useBuffering';
import useHeavyAnimationCheckForVideo from '../../../hooks/useHeavyAnimationCheckForVideo';
import useVideoCleanup from '../../../hooks/useVideoCleanup';
import usePauseOnInactive from './hooks/usePauseOnInactive';
import useBlurredMediaThumbRef from './hooks/useBlurredMediaThumbRef';

import ProgressSpinner from '../../ui/ProgressSpinner';

export type OwnProps = {
  id?: string;
  message: ApiMessage;
  observeIntersection: ObserveFn;
  noAvatars?: boolean;
  shouldAutoLoad?: boolean;
  shouldAutoPlay?: boolean;
  uploadProgress?: number;
  dimensions?: IMediaDimensions;
  lastSyncTime?: number;
  onClick?: (id: number) => void;
  onCancelUpload?: (message: ApiMessage) => void;
};

const Video: FC<OwnProps> = ({
  id,
  message,
  observeIntersection,
  noAvatars,
  shouldAutoLoad,
  shouldAutoPlay,
  uploadProgress,
  lastSyncTime,
  dimensions,
  onClick,
  onCancelUpload,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const videoRef = useRef<HTMLVideoElement>(null);

  const video = message.content.video!;
  const localBlobUrl = video.blobUrl;
  const canPlayInline = Boolean(localBlobUrl) || canMessagePlayVideoInline(video);

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const [isDownloadAllowed, setIsDownloadAllowed] = useState(shouldAutoLoad);
  const shouldDownload = Boolean(isDownloadAllowed && isIntersecting && lastSyncTime);
  const [isPlayAllowed, setIsPlayAllowed] = useState(shouldAutoPlay);

  const previewBlobUrl = useMedia(
    getMessageMediaHash(message, 'pictogram'),
    !(isIntersecting && lastSyncTime),
    getMessageMediaFormat(message, 'pictogram'),
    lastSyncTime,
  );
  const thumbRef = useBlurredMediaThumbRef(message);
  const { mediaData, downloadProgress } = useMediaWithDownloadProgress(
    getMessageMediaHash(message, 'inline'),
    !shouldDownload,
    getMessageMediaFormat(message, 'inline'),
    lastSyncTime,
  );

  const fullMediaData = localBlobUrl || mediaData;
  const isInline = Boolean(canPlayInline && isIntersecting && fullMediaData);

  const { isBuffered, bufferingHandlers } = useBuffering(!shouldAutoLoad);
  const { isUploading, isTransferring, transferProgress } = getMediaTransferState(
    message,
    uploadProgress || downloadProgress,
    shouldDownload && (canPlayInline && !isBuffered),
  );
  const wasDownloadDisabled = usePrevious(isDownloadAllowed) === false;
  const {
    shouldRender: shouldRenderSpinner,
    transitionClassNames: spinnerClassNames,
  } = useShowTransition(isTransferring, undefined, wasDownloadDisabled);
  const { shouldRenderThumb, transitionClassNames } = useTransitionForMedia(fullMediaData, 'slow');

  const [playProgress, setPlayProgress] = useState<number>(0);
  const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    setPlayProgress(Math.max(0, e.currentTarget.currentTime - 1));
  }, []);

  const isOwn = isOwnMessage(message);
  const isForwarded = isForwardedMessage(message);
  const { width, height } = dimensions || calculateVideoDimensions(video, isOwn, isForwarded, noAvatars);

  useHeavyAnimationCheckForVideo(videoRef, Boolean(isInline && shouldAutoPlay));

  usePauseOnInactive(videoRef, isPlayAllowed);

  useVideoCleanup(videoRef, [isInline]);

  const handleClick = useCallback(() => {
    if (isUploading) {
      if (onCancelUpload) {
        onCancelUpload(message);
      }
    } else if (canPlayInline && !fullMediaData) {
      setIsDownloadAllowed((isAllowed) => !isAllowed);
    } else if (canPlayInline && fullMediaData && !isPlayAllowed) {
      setIsPlayAllowed(true);
      videoRef.current!.play();
    } else if (onClick) {
      onClick(message.id);
    }
  }, [isUploading, canPlayInline, fullMediaData, isPlayAllowed, onClick, onCancelUpload, message]);

  const className = buildClassName('media-inner dark', !isUploading && 'interactive');
  const videoClassName = buildClassName('full-media', transitionClassNames);

  const style = dimensions
    ? `width: ${width}px; height: ${height}px; left: ${dimensions.x}px; top: ${dimensions.y}px;`
    : '';

  const shouldRenderInlineVideo = isInline;
  const shouldRenderHqPreview = !canPlayInline && mediaData;
  const shouldRenderPlayButton = !canPlayInline || (isDownloadAllowed && !isPlayAllowed && !shouldRenderSpinner);
  const shouldRenderDownloadButton = canPlayInline && !isDownloadAllowed;

  return (
    <div
      ref={ref}
      id={id}
      className={className}
      // @ts-ignore teact feature
      style={style}
      onClick={isUploading ? undefined : handleClick}
    >
      {(!isInline || shouldRenderThumb)
        && (
          <canvas
            ref={thumbRef}
            className="thumbnail"
            // @ts-ignore teact feature
            style={`width: ${width}px; height: ${height}px;`}
          />
        )}
      {previewBlobUrl && (
        <img
          src={previewBlobUrl}
          className="thumbnail"
          // @ts-ignore teact feature
          style={`width: ${width}px; height: ${height}px;`}
          alt=""
        />
      )}

      {shouldRenderInlineVideo && (
        <video
          ref={videoRef}
          className={videoClassName}
          width={width}
          height={height}
          autoPlay={isPlayAllowed}
          muted
          loop
          playsInline
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...bufferingHandlers}
          onTimeUpdate={handleTimeUpdate}
        >
          <source src={fullMediaData} />
        </video>
      )}
      {shouldRenderHqPreview && (
        <img
          src={mediaData}
          className={`full-media ${transitionClassNames}`}
          width={width}
          height={height}
          alt=""
        />
      )}
      {shouldRenderPlayButton && (
        <i className="icon-large-play" />
      )}
      {shouldRenderSpinner && (
        <div className={`media-loading ${spinnerClassNames}`}>
          <ProgressSpinner progress={transferProgress} onClick={isUploading ? handleClick : undefined} />
        </div>
      )}
      {shouldRenderDownloadButton && (
        <i className="icon-download" />
      )}
      {isTransferring && !canPlayInline ? (
        <span className="message-upload-progress">{Math.round(transferProgress * 100)}%</span>
      ) : isTransferring && canPlayInline ? (
        <span className="message-upload-progress">...</span>
      ) : (
        <div className="message-media-duration">
          {video.isGif ? 'GIF' : formatMediaDuration(video.duration - playProgress)}
        </div>
      )}
    </div>
  );
};

export default Video;
