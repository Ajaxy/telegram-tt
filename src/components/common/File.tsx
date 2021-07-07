import { RefObject } from 'react';
import React, { FC, memo, useRef } from '../../lib/teact/teact';

import useShowTransition from '../../hooks/useShowTransition';
import useTransitionForMedia from '../../hooks/useTransitionForMedia';
import buildClassName from '../../util/buildClassName';
import { formatMediaDateTime, formatPastTimeShort } from '../../util/dateFormat';
import { getColorFromExtension, getFileSizeString } from './helpers/documentInfo';
import { getDocumentThumbnailDimensions } from './helpers/mediaDimensions';
import renderText from './helpers/renderText';
import useLang from '../../hooks/useLang';

import ProgressSpinner from '../ui/ProgressSpinner';
import Link from '../ui/Link';

import './File.scss';

type OwnProps = {
  ref?: RefObject<HTMLDivElement>;
  name: string;
  extension?: string;
  size: number;
  timestamp?: number;
  sender?: string;
  thumbnailDataUri?: string;
  previewData?: string;
  className?: string;
  smaller?: boolean;
  isTransferring?: boolean;
  isUploading?: boolean;
  isSelectable?: boolean;
  isSelected?: boolean;
  transferProgress?: number;
  actionIcon?: string;
  onClick?: () => void;
  onDateClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
};

const File: FC<OwnProps> = ({
  ref,
  name,
  size,
  extension = '',
  timestamp,
  sender,
  thumbnailDataUri,
  previewData,
  className,
  smaller,
  isTransferring,
  isUploading,
  isSelectable,
  isSelected,
  transferProgress,
  actionIcon,
  onClick,
  onDateClick,
}) => {
  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  let elementRef = useRef<HTMLDivElement>(null);
  if (ref) {
    elementRef = ref;
  }

  const {
    shouldRender: shouldSpinnerRender,
    transitionClassNames: spinnerClassNames,
  } = useShowTransition(isTransferring, undefined, true);
  const color = getColorFromExtension(extension);
  const sizeString = getFileSizeString(size);

  const {
    shouldRenderThumb, shouldRenderFullMedia, transitionClassNames,
  } = useTransitionForMedia(previewData, 'slow');
  const { width, height } = getDocumentThumbnailDimensions(smaller);

  const fullClassName = buildClassName(
    'File',
    className,
    smaller && 'smaller',
    onClick && !isUploading && 'interactive',
    isSelected && 'file-is-selected',
  );

  return (
    <div ref={elementRef} className={fullClassName} dir={lang.isRtl ? 'rtl' : undefined}>
      {isSelectable && (
        <div className="message-select-control">
          {isSelected && <i className="icon-select" />}
        </div>
      )}
      <div className="file-icon-container" onClick={isUploading ? undefined : onClick}>
        {thumbnailDataUri || previewData ? (
          <div className="file-preview media-inner">
            {shouldRenderThumb && (
              <img
                src={thumbnailDataUri}
                width={width}
                height={height}
                className="thumbnail"
                alt=""
              />
            )}
            {shouldRenderFullMedia && (
              <img
                src={previewData}
                className={`full-media ${transitionClassNames}`}
                width={width}
                height={height}
                alt=""
              />
            )}
          </div>
        ) : (
          <div className={`file-icon ${color}`}>
            {extension.length <= 4 && (
              <span className="file-ext" dir="auto">{extension}</span>
            )}
          </div>
        )}
        {shouldSpinnerRender && (
          <div className={buildClassName('file-progress', color, spinnerClassNames)}>
            <ProgressSpinner
              progress={transferProgress}
              size={smaller ? 's' : 'm'}
              onClick={isUploading ? onClick : undefined}
            />
          </div>
        )}
        {onClick && (
          <i
            className={buildClassName(
              'action-icon',
              actionIcon || 'icon-download',
              shouldSpinnerRender && 'hidden',
            )}
          />
        )}
      </div>
      <div className="file-info">
        <div className="file-title" dir="auto">{renderText(name)}</div>
        <div className="file-subtitle" dir="auto">
          <span>
            {isTransferring && transferProgress ? `${Math.round(transferProgress * 100)}%` : sizeString}
          </span>
          {sender && <span className="file-sender">{renderText(sender)}</span>}
          {!sender && timestamp && (
            <>
              {' '}
              <Link onClick={onDateClick}>{formatMediaDateTime(lang, timestamp * 1000)}</Link>
            </>
          )}
        </div>
      </div>
      {sender && timestamp && (
        <Link onClick={onDateClick}>{formatPastTimeShort(lang, timestamp * 1000)}</Link>
      )}
    </div>
  );
};

export default memo(File);
