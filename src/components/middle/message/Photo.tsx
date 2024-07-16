import React, { useEffect, useRef, useState } from '../../../lib/teact/teact';

import type { ApiMediaExtendedPreview, ApiPhoto } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { ISettings } from '../../../types';
import type { IMediaDimensions } from './helpers/calculateAlbumLayout';

import { CUSTOM_APPENDIX_ATTRIBUTE, MESSAGE_CONTENT_SELECTOR } from '../../../config';
import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import {
  getMediaFormat,
  getMediaThumbUri,
  getMediaTransferState,
  getPhotoMediaHash,
} from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import getCustomAppendixBg from './helpers/getCustomAppendixBg';
import { calculateMediaDimensions, MIN_MEDIA_HEIGHT } from './helpers/mediaDimensions';

import useAppLayout from '../../../hooks/useAppLayout';
import useFlag from '../../../hooks/useFlag';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import useLayoutEffectWithPrevDeps from '../../../hooks/useLayoutEffectWithPrevDeps';
import useMediaTransition from '../../../hooks/useMediaTransition';
import useMediaWithLoadProgress from '../../../hooks/useMediaWithLoadProgress';
import usePrevious from '../../../hooks/usePrevious';
import useShowTransition from '../../../hooks/useShowTransition';
import useBlurredMediaThumbRef from './hooks/useBlurredMediaThumbRef';

import MediaSpoiler from '../../common/MediaSpoiler';
import ProgressSpinner from '../../ui/ProgressSpinner';

export type OwnProps<T> = {
  id?: string;
  photo: ApiPhoto | ApiMediaExtendedPreview;
  isInWebPage?: boolean;
  messageText?: string;
  isOwn?: boolean;
  observeIntersection?: ObserveFn;
  noAvatars?: boolean;
  canAutoLoad?: boolean;
  isInSelectMode?: boolean;
  isSelected?: boolean;
  uploadProgress?: number;
  forcedWidth?: number;
  size?: 'inline' | 'pictogram';
  shouldAffectAppendix?: boolean;
  dimensions?: IMediaDimensions & { isSmall?: boolean };
  asForwarded?: boolean;
  nonInteractive?: boolean;
  isDownloading?: boolean;
  isProtected?: boolean;
  theme: ISettings['theme'];
  className?: string;
  clickArg?: T;
  onClick?: (arg: T, e: React.MouseEvent<HTMLElement>) => void;
  onCancelUpload?: (arg: T) => void;
};

// eslint-disable-next-line @typescript-eslint/comma-dangle
const Photo = <T,>({
  id,
  photo,
  messageText,
  isOwn,
  observeIntersection,
  noAvatars,
  canAutoLoad,
  isInSelectMode,
  isSelected,
  uploadProgress,
  forcedWidth,
  size = 'inline',
  dimensions,
  asForwarded,
  nonInteractive,
  shouldAffectAppendix,
  isDownloading,
  isProtected,
  theme,
  isInWebPage,
  clickArg,
  className,
  onClick,
  onCancelUpload,
}: OwnProps<T>) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  const isPaidPreview = photo.mediaType === 'extendedMediaPreview';

  const localBlobUrl = !isPaidPreview ? photo.blobUrl : undefined;

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const { isMobile } = useAppLayout();
  const [isLoadAllowed, setIsLoadAllowed] = useState(canAutoLoad);
  const shouldLoad = isLoadAllowed && isIntersecting && !isPaidPreview;
  const {
    mediaData, loadProgress,
  } = useMediaWithLoadProgress(!isPaidPreview ? getPhotoMediaHash(photo, size) : undefined, !shouldLoad);
  const fullMediaData = localBlobUrl || mediaData;

  const withBlurredBackground = Boolean(forcedWidth);
  const [withThumb] = useState(!fullMediaData);
  const noThumb = Boolean(fullMediaData);
  const thumbRef = useBlurredMediaThumbRef(photo, noThumb);
  const blurredBackgroundRef = useBlurredMediaThumbRef(photo, !withBlurredBackground);
  const thumbClassNames = useMediaTransition(!noThumb);
  const thumbDataUri = getMediaThumbUri(photo);

  const [isSpoilerShown, showSpoiler, hideSpoiler] = useFlag(isPaidPreview || photo.isSpoiler);

  useEffect(() => {
    if (isPaidPreview || photo.isSpoiler) {
      showSpoiler();
    } else {
      hideSpoiler();
    }
  }, [isPaidPreview, photo]);

  const {
    loadProgress: downloadProgress,
  } = useMediaWithLoadProgress(
    !isPaidPreview ? getPhotoMediaHash(photo, 'download') : undefined,
    !isDownloading,
    !isPaidPreview ? getMediaFormat(photo, 'download') : undefined,
  );

  const {
    isUploading, isTransferring, transferProgress,
  } = getMediaTransferState(
    uploadProgress || (isDownloading ? downloadProgress : loadProgress),
    shouldLoad && !fullMediaData,
    uploadProgress !== undefined,
  );
  const wasLoadDisabled = usePrevious(isLoadAllowed) === false;

  const {
    shouldRender: shouldRenderSpinner,
    transitionClassNames: spinnerClassNames,
  } = useShowTransition(isTransferring, undefined, wasLoadDisabled, 'slow');
  const {
    shouldRender: shouldRenderDownloadButton,
    transitionClassNames: downloadButtonClassNames,
  } = useShowTransition(!fullMediaData && !isLoadAllowed);

  const handleClick = useLastCallback((e: React.MouseEvent<HTMLElement>) => {
    if (isUploading) {
      onCancelUpload?.(clickArg!);
      return;
    }

    if (!fullMediaData) {
      setIsLoadAllowed((isAllowed) => !isAllowed);
      return;
    }

    if (isSpoilerShown) {
      hideSpoiler();
      return;
    }

    onClick?.(clickArg!, e);
  });

  useLayoutEffectWithPrevDeps(([prevShouldAffectAppendix]) => {
    if (!shouldAffectAppendix) {
      if (prevShouldAffectAppendix) {
        ref.current!.closest<HTMLDivElement>(MESSAGE_CONTENT_SELECTOR)!.removeAttribute(CUSTOM_APPENDIX_ATTRIBUTE);
      }
      return;
    }

    const contentEl = ref.current!.closest<HTMLDivElement>(MESSAGE_CONTENT_SELECTOR)!;
    if (fullMediaData) {
      getCustomAppendixBg(fullMediaData, Boolean(isOwn), isSelected, theme).then((appendixBg) => {
        requestMutation(() => {
          contentEl.style.setProperty('--appendix-bg', appendixBg);
          contentEl.setAttribute(CUSTOM_APPENDIX_ATTRIBUTE, '');
        });
      });
    } else {
      contentEl.classList.add('has-appendix-thumb');
    }
  }, [shouldAffectAppendix, fullMediaData, isOwn, isInSelectMode, isSelected, theme]);

  const { width, height, isSmall } = dimensions || calculateMediaDimensions({
    media: photo,
    isOwn,
    asForwarded,
    noAvatars,
    isMobile,
    messageText,
    isInWebPage,
  });

  const componentClassName = buildClassName(
    'media-inner',
    !isUploading && !nonInteractive && 'interactive',
    isSmall && 'small-image',
    width === height && 'square-image',
    height < MIN_MEDIA_HEIGHT && 'fix-min-height',
    className,
  );

  const dimensionsStyle = dimensions ? ` width: ${width}px; left: ${dimensions.x}px; top: ${dimensions.y}px;` : '';
  const style = size === 'inline' ? `height: ${height}px;${dimensionsStyle}` : undefined;

  return (
    <div
      id={id}
      ref={ref}
      className={componentClassName}
      style={style}
      onClick={isUploading ? undefined : handleClick}
    >
      {withBlurredBackground && (
        <canvas ref={blurredBackgroundRef} className="thumbnail canvas-blur-setup blurred-bg" />
      )}
      <img
        src={fullMediaData}
        className={buildClassName('full-media', withBlurredBackground && 'with-blurred-bg')}
        alt=""
        style={forcedWidth ? `width: ${forcedWidth}px` : undefined}
        draggable={!isProtected}
      />
      {withThumb && (
        <canvas
          ref={thumbRef}
          className={buildClassName('thumbnail', !noThumb && 'canvas-blur-setup', thumbClassNames)}
        />
      )}
      {isProtected && <span className="protector" />}
      {shouldRenderSpinner && !shouldRenderDownloadButton && (
        <div className={`media-loading ${spinnerClassNames}`}>
          <ProgressSpinner progress={transferProgress} onClick={isUploading ? handleClick : undefined} />
        </div>
      )}
      {shouldRenderDownloadButton
        && <i className={buildClassName('icon', 'icon-download', downloadButtonClassNames)} />}
      <MediaSpoiler
        isVisible={isSpoilerShown}
        withAnimation
        thumbDataUri={thumbDataUri}
        width={width}
        height={height}
        className="media-spoiler"
      />
      {isTransferring && (
        <span className="message-transfer-progress">{Math.round(transferProgress * 100)}%</span>
      )}
    </div>
  );
};

export default Photo;
