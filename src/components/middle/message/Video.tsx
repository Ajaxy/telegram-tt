import type { FC } from '../../../lib/teact/teact';
import React, { useCallback, useRef, useState } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMessage } from '../../../api/types';
import type { IMediaDimensions } from './helpers/calculateAlbumLayout';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';

import { formatMediaDuration } from '../../../util/dateFormat';
import buildClassName from '../../../util/buildClassName';
import { calculateVideoDimensions } from '../../common/helpers/mediaDimensions';
import {
  getMediaTransferState,
  getMessageMediaFormat,
  getMessageMediaHash,
  getMessageMediaThumbDataUri,
  getMessageVideo,
  getMessageWebPageVideo,
  isOwnMessage,
} from '../../../global/helpers';
import * as mediaLoader from '../../../util/mediaLoader';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useMediaWithLoadProgress from '../../../hooks/useMediaWithLoadProgress';
import useMedia from '../../../hooks/useMedia';
import useShowTransition from '../../../hooks/useShowTransition';
import usePrevious from '../../../hooks/usePrevious';
import useMediaTransition from '../../../hooks/useMediaTransition';
import useBlurredMediaThumbRef from './hooks/useBlurredMediaThumbRef';
import useFlag from '../../../hooks/useFlag';
import useAppLayout from '../../../hooks/useAppLayout';

import ProgressSpinner from '../../ui/ProgressSpinner';
import OptimizedVideo from '../../ui/OptimizedVideo';
import MediaSpoiler from '../../common/MediaSpoiler';

export type OwnProps = {
  id?: string;
  message: ApiMessage;
  observeIntersectionForLoading: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  noAvatars?: boolean;
  canAutoLoad?: boolean;
  canAutoPlay?: boolean;
  uploadProgress?: number;
  dimensions?: IMediaDimensions;
  asForwarded?: boolean;
  lastSyncTime?: number;
  isDownloading: boolean;
  isProtected?: boolean;
  onClick?: (id: number) => void;
  onCancelUpload?: (message: ApiMessage) => void;
};

const Video: FC<OwnProps> = ({
  id,
  message,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  noAvatars,
  canAutoLoad,
  canAutoPlay,
  uploadProgress,
  lastSyncTime,
  dimensions,
  asForwarded,
  isDownloading,
  isProtected,
  onClick,
  onCancelUpload,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const videoRef = useRef<HTMLVideoElement>(null);

  const video = (getMessageVideo(message) || getMessageWebPageVideo(message))!;
  const localBlobUrl = video.blobUrl;

  const [isSpoilerShown, , hideSpoiler] = useFlag(video.isSpoiler);

  const isIntersectingForLoading = useIsIntersecting(ref, observeIntersectionForLoading);
  const isIntersectingForPlaying = (
    useIsIntersecting(ref, observeIntersectionForPlaying)
    && isIntersectingForLoading
  );
  const wasIntersectedRef = useRef(isIntersectingForLoading);
  if (isIntersectingForPlaying && !wasIntersectedRef.current) {
    wasIntersectedRef.current = true;
  }

  const { isMobile } = useAppLayout();
  const [isLoadAllowed, setIsLoadAllowed] = useState(canAutoLoad);
  const shouldLoad = Boolean(isLoadAllowed && isIntersectingForLoading && lastSyncTime);
  const [isPlayAllowed, setIsPlayAllowed] = useState(canAutoPlay && !isSpoilerShown);

  const fullMediaHash = getMessageMediaHash(message, 'inline');
  const [isFullMediaPreloaded] = useState(Boolean(fullMediaHash && mediaLoader.getFromMemory(fullMediaHash)));
  const { mediaData, loadProgress } = useMediaWithLoadProgress(
    fullMediaHash, !shouldLoad, getMessageMediaFormat(message, 'inline'), lastSyncTime,
  );
  const fullMediaData = localBlobUrl || mediaData;
  const [isPlayerReady, markPlayerReady] = useFlag();

  const thumbDataUri = getMessageMediaThumbDataUri(message);
  const hasThumb = Boolean(thumbDataUri);

  const previewMediaHash = getMessageMediaHash(message, 'preview');
  const [isPreviewPreloaded] = useState(Boolean(previewMediaHash && mediaLoader.getFromMemory(previewMediaHash)));
  const canLoadPreview = isIntersectingForLoading && lastSyncTime;
  const previewBlobUrl = useMedia(previewMediaHash, !canLoadPreview, undefined, lastSyncTime);
  const previewClassNames = useMediaTransition((hasThumb || previewBlobUrl) && !isPlayerReady);

  const noThumb = !hasThumb || previewBlobUrl || isPlayerReady;
  const thumbRef = useBlurredMediaThumbRef(message, noThumb);
  const thumbClassNames = useMediaTransition(!noThumb);

  const isInline = fullMediaData && wasIntersectedRef.current;

  const { loadProgress: downloadProgress } = useMediaWithLoadProgress(
    getMessageMediaHash(message, 'download'),
    !isDownloading,
    getMessageMediaFormat(message, 'download'),
    lastSyncTime,
  );

  const { isUploading, isTransferring, transferProgress } = getMediaTransferState(
    message,
    uploadProgress || (isDownloading ? downloadProgress : loadProgress),
    (shouldLoad && !isPlayerReady && !isFullMediaPreloaded) || isDownloading,
  );

  const wasLoadDisabled = usePrevious(isLoadAllowed) === false;
  const {
    shouldRender: shouldRenderSpinner,
    transitionClassNames: spinnerClassNames,
  } = useShowTransition(isTransferring, undefined, wasLoadDisabled);
  const {
    transitionClassNames: playButtonClassNames,
  } = useShowTransition(Boolean((isLoadAllowed || fullMediaData) && !isPlayAllowed && !shouldRenderSpinner));

  const [playProgress, setPlayProgress] = useState<number>(0);
  const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    setPlayProgress(Math.max(0, e.currentTarget.currentTime - 1));
  }, []);

  const duration = videoRef.current?.duration || video.duration || 0;

  const isOwn = isOwnMessage(message);
  const isWebPageVideo = Boolean(getMessageWebPageVideo(message));
  const {
    width, height,
  } = dimensions || calculateVideoDimensions(video, isOwn, asForwarded, isWebPageVideo, noAvatars, isMobile);

  const handleClick = useCallback(() => {
    if (isUploading) {
      onCancelUpload?.(message);
      return;
    }

    if (isDownloading) {
      getActions().cancelMessageMediaDownload({ message });
      return;
    }

    if (!fullMediaData) {
      setIsLoadAllowed((isAllowed) => !isAllowed);
      return;
    }

    if (fullMediaData && !isPlayAllowed) {
      setIsPlayAllowed(true);
    }

    if (isSpoilerShown) {
      hideSpoiler();
      return;
    }

    onClick?.(message.id);
  }, [
    isUploading, isDownloading, fullMediaData, isPlayAllowed, isSpoilerShown, onClick, message, onCancelUpload,
    hideSpoiler,
  ]);

  const className = buildClassName('media-inner dark', !isUploading && 'interactive');

  const dimensionsStyle = dimensions ? ` width: ${width}px; left: ${dimensions.x}px; top: ${dimensions.y}px;` : '';
  const style = `height: ${height}px;${dimensionsStyle}`;

  return (
    <div
      ref={ref}
      id={id}
      className={className}
      style={style}
      onClick={isUploading ? undefined : handleClick}
    >
      {isInline && (
        <OptimizedVideo
          ref={videoRef}
          src={fullMediaData}
          className="full-media"
          canPlay={isPlayAllowed && isIntersectingForPlaying}
          muted
          loop
          playsInline
          draggable={!isProtected}
          onTimeUpdate={handleTimeUpdate}
          onReady={markPlayerReady}
        />
      )}
      <img
        src={previewBlobUrl}
        className={buildClassName('thumbnail', previewClassNames)}
        alt=""
        draggable={!isProtected}
      />
      {hasThumb && !isPreviewPreloaded && (
        <canvas
          ref={thumbRef}
          className={buildClassName('thumbnail', thumbClassNames)}
        />
      )}
      {isProtected && <span className="protector" />}
      <i className={buildClassName('icon-large-play', playButtonClassNames)} />
      <MediaSpoiler
        isVisible={isSpoilerShown}
        withAnimation
        thumbDataUri={thumbDataUri}
        width={width}
        height={height}
        className="media-spoiler"
      />
      {shouldRenderSpinner && (
        <div className={buildClassName('media-loading', spinnerClassNames)}>
          <ProgressSpinner progress={transferProgress} onClick={handleClick} />
        </div>
      )}
      {!isLoadAllowed && !fullMediaData && (
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
