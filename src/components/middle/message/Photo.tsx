import type React from '../../../lib/teact/teact';
import { useEffect, useRef, useState } from '../../../lib/teact/teact';

import type { ApiMediaExtendedPreview, ApiPhoto } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { ThemeKey } from '../../../types';
import type { IMediaDimensions } from './helpers/calculateAlbumLayout';

import { CUSTOM_APPENDIX_ATTRIBUTE, MESSAGE_CONTENT_SELECTOR } from '../../../config';
import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import {
  getMediaFormat, getMediaThumbUri, getMediaTransferState, getPhotoMediaHash,
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
import usePreviousDeprecated from '../../../hooks/usePreviousDeprecated';
import useShowTransition from '../../../hooks/useShowTransition';
import useBlurredMediaThumbRef from './hooks/useBlurredMediaThumbRef';

import Icon from '../../common/icons/Icon';
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
  theme: ThemeKey;
  className?: string;
  clickArg?: T;
  onClick?: (arg: T, e: React.MouseEvent<HTMLElement>) => void;
  onCancelUpload?: (arg: T) => void;
};

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
  const ref = useRef<HTMLDivElement>();
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
  useMediaTransition(!noThumb, { ref: thumbRef });
  const blurredBackgroundRef = useBlurredMediaThumbRef(photo, !withBlurredBackground);
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
  const wasLoadDisabled = usePreviousDeprecated(isLoadAllowed) === false;

  const {
    ref: spinnerRef,
    shouldRender: shouldRenderSpinner,
  } = useShowTransition({
    isOpen: isTransferring,
    noMountTransition: wasLoadDisabled,
    className: 'slow',
    withShouldRender: true,
  });
  const {
    ref: downloadButtonRef,
    shouldRender: shouldRenderDownloadButton,
  } = useShowTransition({
    isOpen: !fullMediaData && !isLoadAllowed,
    withShouldRender: true,
  });

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
      const messageId = Number(contentEl.closest<HTMLDivElement>('.Message')!.dataset.messageId);
      getCustomAppendixBg(fullMediaData, Boolean(isOwn), messageId, isSelected, theme).then((appendixBg) => {
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
    (width === height || size === 'pictogram') && 'square-image',
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
        <canvas ref={blurredBackgroundRef} className="thumbnail blurred-bg" />
      )}
      {fullMediaData && (
        <img
          src={fullMediaData}
          className={buildClassName('full-media', withBlurredBackground && 'with-blurred-bg')}
          alt=""
          style={forcedWidth ? `width: ${forcedWidth}px` : undefined}
          draggable={!isProtected}
        />
      )}
      {withThumb && (
        <canvas ref={thumbRef} className="thumbnail" />
      )}
      {isProtected && <span className="protector" />}
      {shouldRenderSpinner && !shouldRenderDownloadButton && (
        <div ref={spinnerRef} className="media-loading">
          <ProgressSpinner progress={transferProgress} onClick={isUploading ? handleClick : undefined} />
        </div>
      )}
      {shouldRenderDownloadButton && <Icon ref={downloadButtonRef} name="download" />}
      <MediaSpoiler
        isVisible={isSpoilerShown}
        withAnimation
        thumbDataUri={thumbDataUri}
        width={width}
        height={height}
        className="media-spoiler"
      />
      {isTransferring && (
        <span className="message-transfer-progress">
          {Math.round(transferProgress * 100)}
          %
        </span>
      )}
    </div>
  );
};

export default Photo;
