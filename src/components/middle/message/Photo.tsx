import { memo, useEffect, useRef, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiMediaExtendedPreview, ApiPhoto } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { ThemeKey } from '../../../types';

import { CUSTOM_APPENDIX_ATTRIBUTE, MESSAGE_CONTENT_SELECTOR } from '../../../config';
import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import {
  getMediaDimensions, getMediaFormat, getMediaThumbUri, getMediaTransferState, getPhotoMediaHash,
} from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import getCustomAppendixBg from './helpers/getCustomAppendixBg';

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
import MediaBadge from './MediaBadge';

import styles from './media.module.scss';

export type OwnProps<T> = {
  id?: string;
  photo: ApiPhoto | ApiMediaExtendedPreview;
  isOwn?: boolean;
  canAutoLoad?: boolean;
  isInSelectMode?: boolean;
  isSelected?: boolean;
  uploadProgress?: number;
  size?: 'inline' | 'pictogram';
  layout?: 'intrinsic' | 'fill';
  shouldAffectAppendix?: boolean;
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
  isOwn,
  canAutoLoad,
  isInSelectMode,
  isSelected,
  uploadProgress,
  size = 'inline',
  layout = 'intrinsic',
  nonInteractive,
  shouldAffectAppendix,
  isDownloading,
  isProtected,
  theme,
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
  const { width, height } = getMediaDimensions(photo);

  const localBlobUrl = !isPaidPreview ? photo.blobUrl : undefined;

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

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

  const withBlurredBackground = layout !== 'fill' && size === 'inline';
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

  const componentClassName = buildClassName(
    'media-inner',
    styles.frame,
    styles[layout],
    size === 'pictogram' && styles.pictogram,
    !isUploading && !nonInteractive && 'interactive',
    (width === height || size === 'pictogram') && 'square-image',
    className,
  );

  const style = size === 'inline' ? buildStyle(
    `--media-width: ${width}px`,
    `--media-aspect-ratio: ${width / height}`,
  ) : undefined;

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
          className="full-media"
          alt=""
          draggable={!isProtected}
        />
      )}
      {withThumb && (
        <canvas ref={thumbRef} className="thumbnail" />
      )}
      {isProtected && <span className="protector" />}
      {shouldRenderSpinner && !shouldRenderDownloadButton && (
        <div ref={spinnerRef} className={buildClassName('media-loading', styles.loading)}>
          <ProgressSpinner progress={transferProgress} onClick={isUploading ? handleClick : undefined} />
        </div>
      )}
      {shouldRenderDownloadButton && (
        <Icon
          ref={downloadButtonRef}
          name="download"
          className={buildClassName(styles.controlButton, styles.downloadButton)}
        />
      )}
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
        <MediaBadge ref={transferProgressRef} className="message-transfer-progress">
          {`${Math.round(transferProgress * 100)}%`}
        </MediaBadge>
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
