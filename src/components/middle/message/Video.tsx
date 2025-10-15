import type React from '../../../lib/teact/teact';
import { memo, useEffect, useRef, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiMediaExtendedPreview, ApiVideo } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { IMediaDimensions } from './helpers/calculateAlbumLayout';

import {
  getMediaFormat, getMediaThumbUri, getMediaTransferState, getVideoMediaHash,
} from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { formatMediaDuration } from '../../../util/dates/dateFormat';
import * as mediaLoader from '../../../util/mediaLoader';
import { calculateExtendedPreviewDimensions, calculateVideoDimensions } from '../../common/helpers/mediaDimensions';
import { MIN_MEDIA_HEIGHT } from './helpers/mediaDimensions';

import useUnsupportedMedia from '../../../hooks/media/useUnsupportedMedia';
import useAppLayout from '../../../hooks/useAppLayout';
import useFlag from '../../../hooks/useFlag';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import useMediaTransition from '../../../hooks/useMediaTransition';
import useMediaWithLoadProgress from '../../../hooks/useMediaWithLoadProgress';
import usePreviousDeprecated from '../../../hooks/usePreviousDeprecated';
import useShowTransition from '../../../hooks/useShowTransition';
import useBlurredMediaThumbRef from './hooks/useBlurredMediaThumbRef';

import Icon from '../../common/icons/Icon';
import MediaSpoiler from '../../common/MediaSpoiler';
import SensitiveContentConfirmModal from '../../common/SensitiveContentConfirmModal';
import OptimizedVideo from '../../ui/OptimizedVideo';
import ProgressSpinner from '../../ui/ProgressSpinner';

export type OwnProps<T> = {
  id?: string;
  video: ApiVideo | ApiMediaExtendedPreview;
  lastPlaybackTimestamp?: number;
  isOwn?: boolean;
  isInWebPage?: boolean;
  noAvatars?: boolean;
  canAutoLoad?: boolean;
  canAutoPlay?: boolean;
  uploadProgress?: number;
  forcedWidth?: number;
  dimensions?: IMediaDimensions;
  asForwarded?: boolean;
  isDownloading?: boolean;
  isProtected?: boolean;
  className?: string;
  clickArg?: T;
  isMediaNsfw?: boolean;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  onClick?: (arg: T, e: React.MouseEvent<HTMLElement>) => void;
  onCancelUpload?: (arg: T) => void;
};

type StateProps = {
  needsAgeVerification?: boolean;
};

const Video = <T,>({
  id,
  video,
  isOwn,
  isInWebPage,
  noAvatars,
  canAutoLoad,
  canAutoPlay,
  uploadProgress,
  forcedWidth,
  dimensions,
  asForwarded,
  isDownloading,
  isProtected,
  className,
  lastPlaybackTimestamp,
  clickArg,
  isMediaNsfw,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  onClick,
  onCancelUpload,
  needsAgeVerification,
}: OwnProps<T> & StateProps) => {
  const { cancelMediaDownload, updateContentSettings, openAgeVerificationModal } = getActions();
  const ref = useRef<HTMLDivElement>();
  const videoRef = useRef<HTMLVideoElement>();
  const [isNsfwModalOpen, openNsfwModal, closeNsfwModal] = useFlag();
  const [shouldAlwaysShowNsfw, setShouldAlwaysShowNsfw] = useState(false);

  const isPaidPreview = video.mediaType === 'extendedMediaPreview';

  const localBlobUrl = !isPaidPreview ? video.blobUrl : undefined;

  const shouldShowSpoiler = isPaidPreview || video.isSpoiler || isMediaNsfw;
  const [isSpoilerShown, showSpoiler, hideSpoiler] = useFlag(shouldShowSpoiler);

  useEffect(() => {
    if (shouldShowSpoiler) {
      showSpoiler();
    } else {
      hideSpoiler();
    }
  }, [shouldShowSpoiler]);

  const handleNsfwConfirm = useLastCallback(() => {
    closeNsfwModal();
    hideSpoiler();

    if (shouldAlwaysShowNsfw) {
      updateContentSettings({ isSensitiveEnabled: true });
    }
  });

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
  const shouldLoad = Boolean(isLoadAllowed && isIntersectingForLoading && !isPaidPreview);
  const [isPlayAllowed, setIsPlayAllowed] = useState(Boolean(canAutoPlay && !isSpoilerShown));

  const fullMediaHash = !isPaidPreview ? getVideoMediaHash(video, 'inline') : undefined;
  const [isFullMediaPreloaded] = useState(Boolean(fullMediaHash && mediaLoader.getFromMemory(fullMediaHash)));
  const { mediaData, loadProgress } = useMediaWithLoadProgress(
    fullMediaHash,
    !shouldLoad,
    !isPaidPreview ? getMediaFormat(video, 'inline') : undefined,
  );
  const fullMediaData = localBlobUrl || mediaData;
  const [isPlayerReady, markPlayerReady] = useFlag();

  const thumbDataUri = getMediaThumbUri(video);
  const hasThumb = Boolean(thumbDataUri);
  const withBlurredBackground = Boolean(forcedWidth);

  const isInline = fullMediaData && wasIntersectedRef.current;

  const isUnsupported = useUnsupportedMedia(videoRef, true, !isInline);

  const previewMediaHash = !isPaidPreview ? getVideoMediaHash(video, 'preview') : undefined;
  const [isPreviewPreloaded] = useState(Boolean(previewMediaHash && mediaLoader.getFromMemory(previewMediaHash)));
  const canLoadPreview = isIntersectingForLoading;
  const previewBlobUrl = useMedia(previewMediaHash, !canLoadPreview);
  const shouldHidePreview = isPlayerReady && !isUnsupported;
  const { ref: previewRef } = useMediaTransition<HTMLImageElement>({
    hasMediaData: Boolean((hasThumb || previewBlobUrl) && !shouldHidePreview),
  });

  const noThumb = Boolean(!hasThumb || previewBlobUrl || isPlayerReady);
  const thumbRef = useBlurredMediaThumbRef(video, noThumb);
  useMediaTransition({ ref: thumbRef, hasMediaData: !noThumb });
  const blurredBackgroundRef = useBlurredMediaThumbRef(video, !withBlurredBackground);

  const { loadProgress: downloadProgress } = useMediaWithLoadProgress(
    !isPaidPreview ? getVideoMediaHash(video, 'download') : undefined,
    !isDownloading,
    !isPaidPreview ? getMediaFormat(video, 'download') : undefined,
  );

  const { isUploading, isTransferring, transferProgress } = getMediaTransferState(
    uploadProgress || (isDownloading ? downloadProgress : loadProgress),
    (shouldLoad && !isPlayerReady && !isFullMediaPreloaded) || isDownloading,
    uploadProgress !== undefined,
  );

  const wasLoadDisabled = usePreviousDeprecated(isLoadAllowed) === false;
  const {
    ref: spinnerRef,
    shouldRender: shouldRenderSpinner,
  } = useShowTransition({
    isOpen: isTransferring && !isUnsupported,
    noMountTransition: wasLoadDisabled,
    withShouldRender: true,
  });
  const {
    ref: playButtonRef,
  } = useShowTransition({
    isOpen: Boolean((isLoadAllowed || fullMediaData) && !isPlayAllowed && !shouldRenderSpinner),
  });
  const {
    ref: transferProgressRef,
    shouldRender: shouldRenderTransferProgress,
  } = useShowTransition({
    isOpen: isTransferring && (!isUnsupported || isDownloading),
    noMountTransition: wasLoadDisabled,
    withShouldRender: true,
  });

  const [playProgress, setPlayProgress] = useState<number>(0);
  const handleTimeUpdate = useLastCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    setPlayProgress(Math.max(0, e.currentTarget.currentTime - 1));
  });

  const duration = (Number.isFinite(videoRef.current?.duration) && !isUnsupported
    ? videoRef.current?.duration : video.duration) || 0;

  const {
    width, height,
  } = dimensions || (
    isPaidPreview
      ? calculateExtendedPreviewDimensions(video, Boolean(isOwn), asForwarded, isInWebPage, noAvatars, isMobile)
      : calculateVideoDimensions(video, Boolean(isOwn), asForwarded, isInWebPage, noAvatars, isMobile)
  );

  const handleClick = useLastCallback((e: React.MouseEvent<HTMLElement, MouseEvent>, isFromSpinner?: boolean) => {
    if (isUploading) {
      onCancelUpload?.(clickArg!);
      return;
    }

    if (!isPaidPreview && isDownloading) {
      cancelMediaDownload({ media: video });
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
      if (isMediaNsfw) {
        if (needsAgeVerification) {
          openAgeVerificationModal();
          return;
        }
        openNsfwModal();
        return;
      }
      hideSpoiler();
      return;
    }

    if (isFromSpinner && shouldLoad && !isPlayerReady && !isFullMediaPreloaded) {
      setIsLoadAllowed(false);
      e.stopPropagation();
      return;
    }

    onClick?.(clickArg!, e);
  });

  const handleClickOnSpinner = useLastCallback(
    (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
      handleClick(e, true);
    },
  );

  const componentClassName = buildClassName(
    'media-inner dark',
    !isUploading && 'interactive',
    height < MIN_MEDIA_HEIGHT && 'fix-min-height',
    className,
  );

  const dimensionsStyle = dimensions ? ` width: ${width}px; left: ${dimensions.x}px; top: ${dimensions.y}px;` : '';
  const style = `height: ${height}px;${dimensionsStyle}`;

  return (
    <div
      ref={ref}
      id={id}
      className={componentClassName}
      style={style}
      onClick={isUploading ? undefined : (e) => handleClick(e)}
    >
      {withBlurredBackground && (
        <canvas ref={blurredBackgroundRef} className="thumbnail blurred-bg" />
      )}
      {isInline && (
        <OptimizedVideo
          ref={videoRef}
          src={fullMediaData}
          className={buildClassName('full-media', withBlurredBackground && 'with-blurred-bg')}
          canPlay={isPlayAllowed && isIntersectingForPlaying && !isUnsupported}
          defaultMuted
          muted
          loop
          playsInline
          disablePictureInPicture
          draggable={!isProtected}
          onTimeUpdate={handleTimeUpdate}
          onReady={markPlayerReady}
          style={forcedWidth ? `width: ${forcedWidth}px` : undefined}
        />
      )}
      <img
        ref={previewRef}
        src={previewBlobUrl}
        className={buildClassName('thumbnail', withBlurredBackground && 'with-blurred-bg')}
        alt=""
        style={forcedWidth ? `width: ${forcedWidth}px;` : undefined}
        draggable={!isProtected}
      />
      {hasThumb && !isPreviewPreloaded && (
        <canvas ref={thumbRef} className="thumbnail" />
      )}
      {isProtected && <span className="protector" />}
      <Icon ref={playButtonRef} name="large-play" />
      <MediaSpoiler
        isVisible={isSpoilerShown}
        withAnimation
        thumbDataUri={thumbDataUri}
        isNsfw={isMediaNsfw}
        width={width}
        height={height}
        className="media-spoiler"
      />
      {shouldRenderSpinner && (
        <div ref={spinnerRef} className="media-loading">
          <ProgressSpinner
            progress={transferProgress}
            onClick={handleClickOnSpinner}
          />
        </div>
      )}
      {!isLoadAllowed && !fullMediaData && (
        <Icon name="download" />
      )}
      {shouldRenderTransferProgress ? (
        <span ref={transferProgressRef} className="message-transfer-progress">
          {(isUploading || isDownloading) ? `${Math.round(transferProgress * 100)}%` : '...'}
        </span>
      ) : (
        <div className="message-media-duration">
          {!isPaidPreview && video.isGif ? 'GIF' : formatMediaDuration(Math.max(duration - playProgress, 0))}
          {isUnsupported && <Icon name="message-failed" className="playback-failed" />}
        </div>
      )}
      {Boolean(lastPlaybackTimestamp) && (
        <div
          className="message-media-last-progress"
          style={`--_progress: ${Math.floor((lastPlaybackTimestamp / duration) * 100)}%`}
        />
      )}
      <SensitiveContentConfirmModal
        isOpen={isNsfwModalOpen}
        onClose={closeNsfwModal}
        shouldAlwaysShow={shouldAlwaysShowNsfw}
        onAlwaysShowChanged={setShouldAlwaysShowNsfw}
        confirmHandler={handleNsfwConfirm}
      />
    </div>
  );
};

export default memo(withGlobal((global): Complete<StateProps> => {
  const appConfig = global.appConfig;
  const needsAgeVerification = appConfig.needAgeVideoVerification;

  return {
    needsAgeVerification,
  };
})(Video));
