import type { FC } from '../../../lib/teact/teact';
import React, {
  useCallback, useLayoutEffect, useRef, useState,
} from '../../../lib/teact/teact';

import type { ApiMessage } from '../../../api/types';
import type { ISettings } from '../../../types';
import type { IMediaDimensions } from './helpers/calculateAlbumLayout';

import { CUSTOM_APPENDIX_ATTRIBUTE } from '../../../config';
import {
  getMessagePhoto,
  getMessageWebPagePhoto,
  getMessageMediaHash,
  getMediaTransferState,
  isOwnMessage,
} from '../../../global/helpers';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useMediaWithLoadProgress from '../../../hooks/useMediaWithLoadProgress';
import useShowTransition from '../../../hooks/useShowTransition';
import useBlurredMediaThumbRef from './hooks/useBlurredMediaThumbRef';
import usePrevious from '../../../hooks/usePrevious';
import useMediaTransition from '../../../hooks/useMediaTransition';
import buildClassName from '../../../util/buildClassName';
import getCustomAppendixBg from './helpers/getCustomAppendixBg';
import { calculateMediaDimensions } from './helpers/mediaDimensions';

import ProgressSpinner from '../../ui/ProgressSpinner';

export type OwnProps = {
  id?: string;
  message: ApiMessage;
  observeIntersection?: ObserveFn;
  noAvatars?: boolean;
  canAutoLoad?: boolean;
  isInSelectMode?: boolean;
  isSelected?: boolean;
  uploadProgress?: number;
  size?: 'inline' | 'pictogram';
  shouldAffectAppendix?: boolean;
  dimensions?: IMediaDimensions & { isSmall?: boolean };
  nonInteractive?: boolean;
  isDownloading: boolean;
  isProtected?: boolean;
  withAspectRatio?: boolean;
  theme: ISettings['theme'];
  onClick?: (id: number) => void;
  onCancelUpload?: (message: ApiMessage) => void;
};

const Photo: FC<OwnProps> = ({
  id,
  message,
  observeIntersection,
  noAvatars,
  canAutoLoad,
  isInSelectMode,
  isSelected,
  uploadProgress,
  size = 'inline',
  dimensions,
  nonInteractive,
  shouldAffectAppendix,
  isDownloading,
  isProtected,
  withAspectRatio,
  theme,
  onClick,
  onCancelUpload,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const photo = (getMessagePhoto(message) || getMessageWebPagePhoto(message))!;
  const localBlobUrl = photo.blobUrl;

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const [isLoadAllowed, setIsLoadAllowed] = useState(canAutoLoad);
  const shouldLoad = isLoadAllowed && isIntersecting;
  const {
    mediaData, loadProgress,
  } = useMediaWithLoadProgress(getMessageMediaHash(message, size), !shouldLoad);
  const fullMediaData = localBlobUrl || mediaData;
  const thumbRef = useBlurredMediaThumbRef(message, fullMediaData);

  const {
    loadProgress: downloadProgress,
  } = useMediaWithLoadProgress(getMessageMediaHash(message, 'download'), !isDownloading);

  const {
    isUploading, isTransferring, transferProgress,
  } = getMediaTransferState(
    message,
    uploadProgress || (isDownloading ? downloadProgress : loadProgress),
    shouldLoad && !fullMediaData,
  );
  const wasLoadDisabled = usePrevious(isLoadAllowed) === false;

  const transitionClassNames = useMediaTransition(fullMediaData);
  const {
    shouldRender: shouldRenderSpinner,
    transitionClassNames: spinnerClassNames,
  } = useShowTransition(isTransferring, undefined, wasLoadDisabled, 'slow');
  const {
    shouldRender: shouldRenderDownloadButton,
    transitionClassNames: downloadButtonClassNames,
  } = useShowTransition(!fullMediaData && !isLoadAllowed);

  const handleClick = useCallback(() => {
    if (isUploading) {
      if (onCancelUpload) {
        onCancelUpload(message);
      }
    } else if (!fullMediaData) {
      setIsLoadAllowed((isAllowed) => !isAllowed);
    } else if (onClick) {
      onClick(message.id);
    }
  }, [fullMediaData, isUploading, message, onCancelUpload, onClick]);

  const isOwn = isOwnMessage(message);
  useLayoutEffect(() => {
    if (!shouldAffectAppendix) {
      return;
    }

    const contentEl = ref.current!.closest<HTMLDivElement>('.message-content')!;

    if (fullMediaData) {
      getCustomAppendixBg(fullMediaData, isOwn, isInSelectMode, isSelected, theme).then((appendixBg) => {
        contentEl.style.setProperty('--appendix-bg', appendixBg);
        contentEl.setAttribute(CUSTOM_APPENDIX_ATTRIBUTE, '');
      });
    } else {
      contentEl.classList.add('has-appendix-thumb');
    }
  }, [fullMediaData, isOwn, shouldAffectAppendix, isInSelectMode, isSelected, theme]);

  const { width, height, isSmall } = dimensions || calculateMediaDimensions(message, noAvatars);

  const className = buildClassName(
    'media-inner',
    !isUploading && !nonInteractive && 'interactive',
    isSmall && 'small-image',
    width === height && 'square-image',
  );

  const aspectRatio = withAspectRatio ? `aspect-ratio: ${(width / height).toFixed(3)}/ 1` : '';
  const style = dimensions
    ? `width: ${width}px; height: ${height}px; left: ${dimensions.x}px; top: ${dimensions.y}px;${aspectRatio}`
    : '';

  return (
    <div
      id={id}
      ref={ref}
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
        src={fullMediaData}
        className={`full-media ${transitionClassNames}`}
        width={width}
        height={height}
        alt=""
        draggable={!isProtected}
      />
      {isProtected && <span className="protector" />}
      {shouldRenderSpinner && !shouldRenderDownloadButton && (
        <div className={`media-loading ${spinnerClassNames}`}>
          <ProgressSpinner progress={transferProgress} onClick={isUploading ? handleClick : undefined} />
        </div>
      )}
      {shouldRenderDownloadButton && <i className={buildClassName('icon-download', downloadButtonClassNames)} />}
      {isTransferring && (
        <span className="message-transfer-progress">{Math.round(transferProgress * 100)}%</span>
      )}
    </div>
  );
};

export default Photo;
