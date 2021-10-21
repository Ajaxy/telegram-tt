import React, {
  FC, useCallback, useRef, useState,
} from '../../../lib/teact/teact';
import { getDispatch } from '../../../lib/teact/teactn';

import { ApiMediaFormat, ApiMessage } from '../../../api/types';
import { IMediaDimensions } from './helpers/calculateAlbumLayout';

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
} from '../../../modules/helpers';
import { ObserveFn, useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useMediaWithLoadProgress from '../../../hooks/useMediaWithLoadProgress';
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
  isDownloading: boolean;
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
  isDownloading,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const videoRef = useRef<HTMLVideoElement>(null);

  const video = (getMessageVideo(message) || getMessageWebPageVideo(message))!;
  const localBlobUrl = video.blobUrl;

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const [isLoadAllowed, setIsLoadAllowed] = useState(shouldAutoLoad);
  const shouldLoad = Boolean(isLoadAllowed && isIntersecting && lastSyncTime);
  const [isPlayAllowed, setIsPlayAllowed] = useState(shouldAutoPlay);

  const previewBlobUrl = useMedia(
    getMessageMediaHash(message, 'pictogram'),
    !(isIntersecting && lastSyncTime),
    getMessageMediaFormat(message, 'pictogram'),
    lastSyncTime,
  );
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

  const { isBuffered, bufferingHandlers } = useBuffering(!shouldAutoLoad);
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
  const { transitionClassNames } = useTransitionForMedia(fullMediaData, 'slow');

  const [playProgress, setPlayProgress] = useState<number>(0);
  const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    setPlayProgress(Math.max(0, e.currentTarget.currentTime - 1));
  }, []);

  const duration = (videoRef.current?.duration) || video.duration || 0;

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
    } else if (isDownloading) {
      getDispatch().cancelMessageMediaDownload({ message });
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
  const videoClassName = buildClassName('full-media', transitionClassNames);

  const style = dimensions
    ? `width: ${width}px; height: ${height}px; left: ${dimensions.x}px; top: ${dimensions.y}px;`
    : '';

  return (
    <div
      ref={ref}
      id={id}
      className={className}
      // @ts-ignore teact feature
      style={style}
      onClick={isUploading ? undefined : handleClick}
    >
      {!previewBlobUrl && (
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
      {isInline && (
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
      {(isLoadAllowed && !isPlayAllowed && !shouldRenderSpinner) && (
        <i className="icon-large-play" />
      )}
      {shouldRenderSpinner && (
        <div className={`media-loading ${spinnerClassNames}`}>
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
