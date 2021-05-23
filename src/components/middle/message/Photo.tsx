import React, {
  FC, useCallback, useLayoutEffect, useRef, useState,
} from '../../../lib/teact/teact';

import { ApiMessage } from '../../../api/types';
import { IMediaDimensions } from './helpers/calculateAlbumLayout';

import {
  getMessagePhoto,
  getMessageWebPagePhoto,
  getMessageMediaHash,
  getMediaTransferState,
  isOwnMessage,
} from '../../../modules/helpers';
import { ObserveFn, useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useMediaWithDownloadProgress from '../../../hooks/useMediaWithDownloadProgress';
import useTransitionForMedia from '../../../hooks/useTransitionForMedia';
import useShowTransition from '../../../hooks/useShowTransition';
import useBlurredMediaThumbRef from './hooks/useBlurredMediaThumbRef';
import usePrevious from '../../../hooks/usePrevious';
import buildClassName from '../../../util/buildClassName';
import getCustomAppendixBg from './helpers/getCustomAppendixBg';
import { calculateMediaDimensions } from './helpers/mediaDimensions';

import ProgressSpinner from '../../ui/ProgressSpinner';

export type OwnProps = {
  id?: string;
  message: ApiMessage;
  observeIntersection?: ObserveFn;
  shouldAutoLoad?: boolean;
  isInSelectMode?: boolean;
  isSelected?: boolean;
  uploadProgress?: number;
  size?: 'inline' | 'pictogram';
  shouldAffectAppendix?: boolean;
  dimensions?: IMediaDimensions & { isSmall?: boolean };
  onClick?: (id: number) => void;
  onCancelUpload?: (message: ApiMessage) => void;
};

const CUSTOM_APPENDIX_ATTRIBUTE = 'data-has-custom-appendix';

const Photo: FC<OwnProps> = ({
  id,
  message,
  observeIntersection,
  shouldAutoLoad,
  isInSelectMode,
  isSelected,
  uploadProgress,
  size = 'inline',
  dimensions,
  shouldAffectAppendix,
  onClick,
  onCancelUpload,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const photo = (getMessagePhoto(message) || getMessageWebPagePhoto(message))!;
  const localBlobUrl = photo.blobUrl;

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const [isDownloadAllowed, setIsDownloadAllowed] = useState(shouldAutoLoad);
  const shouldDownload = isDownloadAllowed && isIntersecting;
  const {
    mediaData, downloadProgress,
  } = useMediaWithDownloadProgress(getMessageMediaHash(message, size), !shouldDownload);
  const fullMediaData = localBlobUrl || mediaData;
  const thumbRef = useBlurredMediaThumbRef(message, fullMediaData);

  const {
    isUploading, isTransferring, transferProgress,
  } = getMediaTransferState(message, uploadProgress || downloadProgress, shouldDownload && !fullMediaData);
  const wasDownloadDisabled = usePrevious(isDownloadAllowed) === false;
  const {
    shouldRender: shouldRenderSpinner,
    transitionClassNames: spinnerClassNames,
  } = useShowTransition(isTransferring, undefined, wasDownloadDisabled, 'slow');
  const {
    shouldRenderThumb, shouldRenderFullMedia, transitionClassNames,
  } = useTransitionForMedia(fullMediaData, 'slow');

  const handleClick = useCallback(() => {
    if (isUploading) {
      if (onCancelUpload) {
        onCancelUpload(message);
      }
    } else if (!fullMediaData) {
      setIsDownloadAllowed((isAllowed) => !isAllowed);
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
      getCustomAppendixBg(fullMediaData, isOwn, isInSelectMode, isSelected).then((appendixBg) => {
        contentEl.style.setProperty('--appendix-bg', appendixBg);
        contentEl.setAttribute(CUSTOM_APPENDIX_ATTRIBUTE, '');
      });
    } else {
      contentEl.classList.add('has-appendix-thumb');
    }
  }, [fullMediaData, isOwn, shouldAffectAppendix, isInSelectMode, isSelected]);

  const { width, height, isSmall } = dimensions || calculateMediaDimensions(message);

  const className = buildClassName(
    'media-inner',
    !isUploading && 'interactive',
    isSmall && 'small-image',
    width === height && 'square-image',
  );

  const style = dimensions
    ? `width: ${width}px; height: ${height}px; left: ${dimensions.x}px; top: ${dimensions.y}px;`
    : '';

  return (
    <div
      id={id}
      ref={ref}
      className={className}
      // @ts-ignore teact feature
      style={style}
      onClick={isUploading ? undefined : handleClick}
    >
      {shouldRenderThumb && (
        <canvas
          ref={thumbRef}
          className="thumbnail"
          // @ts-ignore teact feature
          style={`width: ${width}px; height: ${height}px`}
        />
      )}
      {shouldRenderFullMedia && (
        <img
          src={fullMediaData}
          className={`full-media ${transitionClassNames}`}
          width={width}
          height={height}
          alt=""
        />
      )}
      {shouldRenderSpinner && (
        <div className={`media-loading ${spinnerClassNames}`}>
          <ProgressSpinner progress={transferProgress} onClick={isUploading ? handleClick : undefined} />
        </div>
      )}
      {!fullMediaData && !isDownloadAllowed && (
        <i className="icon-download" />
      )}
      {isTransferring && (
        <span className="message-upload-progress">{Math.round(transferProgress * 100)}%</span>
      )}
    </div>
  );
};

export default Photo;
