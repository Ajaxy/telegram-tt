import type React from '../../../lib/teact/teact';
import { memo, useEffect, useRef, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

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
import usePrevious from '../../../hooks/usePrevious';
import usePreviousDeprecated from '../../../hooks/usePreviousDeprecated';
import useShowTransition from '../../../hooks/useShowTransition';
import useBlurredMediaThumbRef from './hooks/useBlurredMediaThumbRef';

import Icon from '../../common/icons/Icon';
import MediaSpoiler from '../../common/MediaSpoiler';
import SensitiveContentConfirmModal from '../../common/SensitiveContentConfirmModal';
import ProgressSpinner from '../../ui/ProgressSpinner';

export type OwnProps<T> = {
  id?: string;
  photo: ApiPhoto | ApiMediaExtendedPreview;
  isInWebPage?: boolean;
  messageText?: string;
  isOwn?: boolean;
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
  isMediaNsfw?: boolean;
  observeIntersection?: ObserveFn;
  onClick?: (arg: T, e: React.MouseEvent<HTMLElement>) => void;
  onCancelUpload?: (arg: T) => void;
};

type StateProps = {
  needsAgeVerification?: boolean;
};

const Photo = <T,>({
  id,
  photo,
  messageText,
  isOwn,
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
  isMediaNsfw,
  observeIntersection,
  onClick,
  onCancelUpload,
  needsAgeVerification,
}: OwnProps<T> & StateProps) => {
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
  const prevMediaData = usePrevious(mediaData);
  const fullMediaData = localBlobUrl || mediaData;

  const { ref: fullMediaRef, shouldRender: shouldRenderFullMedia } = useMediaTransition<HTMLImageElement>({
    hasMediaData: Boolean(fullMediaData),
    withShouldRender: true,
  });

  const withBlurredBackground = Boolean(forcedWidth);
  const [withThumb] = useState(!fullMediaData);
  const noThumb = Boolean(fullMediaData);
  const thumbRef = useBlurredMediaThumbRef(photo, noThumb);
  useMediaTransition({ ref: thumbRef, hasMediaData: !noThumb });
  const blurredBackgroundRef = useBlurredMediaThumbRef(photo, !withBlurredBackground);
  const thumbDataUri = getMediaThumbUri(photo);

  const { updateContentSettings, openAgeVerificationModal } = getActions();
  const [isNsfwModalOpen, openNsfwModal, closeNsfwModal] = useFlag();
  const [shouldAlwaysShowNsfw, setShouldAlwaysShowNsfw] = useState(false);

  const shouldShowSpoiler = isPaidPreview || photo.isSpoiler || isMediaNsfw;
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
  const {
    ref: transferProgressRef,
    shouldRender: shouldRenderTransferProgress,
  } = useShowTransition({
    isOpen: isTransferring,
    noMountTransition: wasLoadDisabled,
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
      {shouldRenderFullMedia && (
        <img
          ref={fullMediaRef}
          src={fullMediaData || prevMediaData}
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
        isNsfw={isMediaNsfw}
      />
      {shouldRenderTransferProgress && (
        <span ref={transferProgressRef} className="message-transfer-progress">
          {`${Math.round(transferProgress * 100)}%`}
        </span>
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
})(Photo));
