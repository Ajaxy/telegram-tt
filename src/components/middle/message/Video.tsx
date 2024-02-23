import type { FC } from '../../../lib/teact/teact';
import React, { useEffect, useRef, useState } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMessage } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { IMediaDimensions } from './helpers/calculateAlbumLayout';

import {
  getMediaTransferState,
  getMessageMediaFormat,
  getMessageMediaHash,
  getMessageMediaThumbDataUri,
  getMessageVideo,
  getMessageWebPageVideo,
  isOwnMessage,
} from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { formatMediaDuration } from '../../../util/dateFormat';
import * as mediaLoader from '../../../util/mediaLoader';
import { calculateVideoDimensions } from '../../common/helpers/mediaDimensions';
import { MIN_MEDIA_HEIGHT } from './helpers/mediaDimensions';

import useUnsupportedMedia from '../../../hooks/media/useUnsupportedMedia';
import useAppLayout from '../../../hooks/useAppLayout';
import useFlag from '../../../hooks/useFlag';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import useMediaTransition from '../../../hooks/useMediaTransition';
import useMediaWithLoadProgress from '../../../hooks/useMediaWithLoadProgress';
import usePrevious from '../../../hooks/usePrevious';
import useShowTransition from '../../../hooks/useShowTransition';
import useBlurredMediaThumbRef from './hooks/useBlurredMediaThumbRef';

import MediaSpoiler from '../../common/MediaSpoiler';
import OptimizedVideo from '../../ui/OptimizedVideo';
import ProgressSpinner from '../../ui/ProgressSpinner';

export type OwnProps = {
  id?: string;
  message: ApiMessage;
  observeIntersectionForLoading: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  noAvatars?: boolean;
  canAutoLoad?: boolean;
  canAutoPlay?: boolean;
  uploadProgress?: number;
  forcedWidth?: number;
  dimensions?: IMediaDimensions;
  asForwarded?: boolean;
  isDownloading?: boolean;
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
  forcedWidth,
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

  const [isSpoilerShown, showSpoiler, hideSpoiler] = useFlag(video.isSpoiler);

  useEffect(() => {
    if (video.isSpoiler) {
      showSpoiler();
    } else {
      hideSpoiler();
    }
  }, [video.isSpoiler]);

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
  const shouldLoad = Boolean(isLoadAllowed && isIntersectingForLoading);
  const [isPlayAllowed, setIsPlayAllowed] = useState(Boolean(canAutoPlay && !isSpoilerShown));

  const fullMediaHash = getMessageMediaHash(message, 'inline');
  const [isFullMediaPreloaded] = useState(Boolean(fullMediaHash && mediaLoader.getFromMemory(fullMediaHash)));
  const { mediaData, loadProgress } = useMediaWithLoadProgress(
    fullMediaHash, !shouldLoad, getMessageMediaFormat(message, 'inline'),
  );
  const fullMediaData = localBlobUrl || mediaData;
  const [isPlayerReady, markPlayerReady] = useFlag();

  const thumbDataUri = getMessageMediaThumbDataUri(message);
  const hasThumb = Boolean(thumbDataUri);
  const withBlurredBackground = Boolean(forcedWidth);

  const previewMediaHash = getMessageMediaHash(message, 'preview');
  const [isPreviewPreloaded] = useState(Boolean(previewMediaHash && mediaLoader.getFromMemory(previewMediaHash)));
  const canLoadPreview = isIntersectingForLoading;
  const previewBlobUrl = useMedia(previewMediaHash, !canLoadPreview);
  const previewClassNames = useMediaTransition((hasThumb || previewBlobUrl) && !isPlayerReady);

  const noThumb = !hasThumb || previewBlobUrl || isPlayerReady;
  const thumbRef = useBlurredMediaThumbRef(message, noThumb);
  const blurredBackgroundRef = useBlurredMediaThumbRef(message, !withBlurredBackground);
  const thumbClassNames = useMediaTransition(!noThumb);

  const isInline = fullMediaData && wasIntersectedRef.current;

  const isUnsupported = useUnsupportedMedia(videoRef, true, !isInline);
  const { loadProgress: downloadProgress } = useMediaWithLoadProgress(
    getMessageMediaHash(message, 'download'),
    !isDownloading,
    getMessageMediaFormat(message, 'download'),
  );

  const { isUploading, isTransferring, transferProgress } = getMediaTransferState(
    message,
    uploadProgress || (isDownloading ? downloadProgress : loadProgress),
    (shouldLoad && !isPlayerReady && !isFullMediaPreloaded) || isDownloading,
    uploadProgress !== undefined,
  );

  const wasLoadDisabled = usePrevious(isLoadAllowed) === false;
  const {
    shouldRender: shouldRenderSpinner,
    transitionClassNames: spinnerClassNames,
  } = useShowTransition(isTransferring && !isUnsupported, undefined, wasLoadDisabled);
  const {
    transitionClassNames: playButtonClassNames,
  } = useShowTransition(Boolean((isLoadAllowed || fullMediaData) && !isPlayAllowed && !shouldRenderSpinner));

  const [playProgress, setPlayProgress] = useState<number>(0);
  const handleTimeUpdate = useLastCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    setPlayProgress(Math.max(0, e.currentTarget.currentTime - 1));
  });

  const duration = (Number.isFinite(videoRef.current?.duration) ? videoRef.current?.duration : video.duration) || 0;

  const isOwn = isOwnMessage(message);
  const isWebPageVideo = Boolean(getMessageWebPageVideo(message));
  const {
    width, height,
  } = dimensions || calculateVideoDimensions(video, isOwn, asForwarded, isWebPageVideo, noAvatars, isMobile);

  const handleClick = useLastCallback(() => {
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
  });

  const className = buildClassName(
    'media-inner dark',
    !isUploading && 'interactive',
    height < MIN_MEDIA_HEIGHT && 'fix-min-height',
  );

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
      {withBlurredBackground && <canvas ref={blurredBackgroundRef} className="thumbnail blurred-bg" />}
      {isInline && (
        <OptimizedVideo
          ref={videoRef}
          src={fullMediaData}
          className={buildClassName('full-media', withBlurredBackground && 'with-blurred-bg')}
          canPlay={isPlayAllowed && isIntersectingForPlaying && !isUnsupported}
          muted
          loop
          playsInline
          draggable={!isProtected}
          onTimeUpdate={handleTimeUpdate}
          onReady={markPlayerReady}
          style={forcedWidth ? `width: ${forcedWidth}px` : undefined}
        />
      )}
      <img
        src={previewBlobUrl}
        className={buildClassName('thumbnail', previewClassNames, withBlurredBackground && 'with-blurred-bg')}
        alt=""
        style={forcedWidth ? `width: ${forcedWidth}px;` : undefined}
        draggable={!isProtected}
      />
      {hasThumb && !isPreviewPreloaded && (
        <canvas
          ref={thumbRef}
          className={buildClassName('thumbnail', thumbClassNames)}
        />
      )}
      {isProtected && <span className="protector" />}
      <i className={buildClassName('icon', 'icon-large-play', playButtonClassNames)} />
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
        <i className="icon icon-download" />
      )}
      {isTransferring && (!isUnsupported || isDownloading) ? (
        <span className="message-transfer-progress">
          {(isUploading || isDownloading) ? `${Math.round(transferProgress * 100)}%` : '...'}
        </span>
      ) : (
        <div className="message-media-duration">
          {video.isGif ? 'GIF' : formatMediaDuration(Math.max(duration - playProgress, 0))}
          {isUnsupported && <i className="icon icon-message-failed playback-failed" />}
        </div>
      )}
    </div>
  );
};

export default Video;
