import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useMemo, useRef, useState,
} from '../../lib/teact/teact';

import type { IconName } from '../../types/icons';

import buildClassName from '../../util/buildClassName';
import { formatMediaDateTime, formatPastTimeShort } from '../../util/date/dateFormat';
import { IS_CANVAS_FILTER_SUPPORTED } from '../../util/windowEnvironment';
import { getColorFromExtension, getFileSizeString } from './helpers/documentInfo';
import { getDocumentThumbnailDimensions } from './helpers/mediaDimensions';
import renderText from './helpers/renderText';

import useAppLayout from '../../hooks/useAppLayout';
import useCanvasBlur from '../../hooks/useCanvasBlur';
import useLang from '../../hooks/useLang';
import useMediaTransition from '../../hooks/useMediaTransition';
import useShowTransition from '../../hooks/useShowTransition';

import Link from '../ui/Link';
import ProgressSpinner from '../ui/ProgressSpinner';

import './File.scss';

type OwnProps = {
  ref?: React.RefObject<HTMLDivElement>;
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
  actionIcon?: IconName;
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

  const { isMobile } = useAppLayout();
  const [withThumb] = useState(!previewData);
  const noThumb = Boolean(previewData);
  const thumbRef = useCanvasBlur(thumbnailDataUri, noThumb, isMobile && !IS_CANVAS_FILTER_SUPPORTED);
  const thumbClassNames = useMediaTransition(!noThumb);

  const {
    shouldRender: shouldSpinnerRender,
    transitionClassNames: spinnerClassNames,
  } = useShowTransition(isTransferring, undefined, true);

  const color = getColorFromExtension(extension);
  const sizeString = getFileSizeString(size);
  const subtitle = useMemo(() => {
    if (!isTransferring || !transferProgress) return sizeString;
    return `${getFileSizeString(size * transferProgress)} / ${sizeString}`;
  }, [isTransferring, size, sizeString, transferProgress]);

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
          {isSelected && <i className="icon icon-select" />}
        </div>
      )}
      <div className="file-icon-container" onClick={isUploading ? undefined : onClick}>
        {thumbnailDataUri || previewData ? (
          <div className="file-preview media-inner">
            <img
              src={previewData}
              className="full-media"
              width={width}
              height={height}
              draggable={false}
              alt=""
            />
            {withThumb && (
              <canvas
                ref={thumbRef}
                className={buildClassName('thumbnail', thumbClassNames)}
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
              'icon',
              actionIcon ? `icon-${actionIcon}` : 'icon-download',
              shouldSpinnerRender && 'hidden',
            )}
          />
        )}
      </div>
      <div className="file-info">
        <div className="file-title" dir="auto" title={name}>{renderText(name)}</div>
        <div className="file-subtitle" dir="auto">
          <span>
            {subtitle}
          </span>
          {sender && <span className="file-sender">{renderText(sender)}</span>}
          {!sender && Boolean(timestamp) && (
            <>
              <span className="bullet" />
              <Link onClick={onDateClick}>{formatMediaDateTime(lang, timestamp * 1000, true)}</Link>
            </>
          )}
        </div>
      </div>
      {sender && Boolean(timestamp) && (
        <Link onClick={onDateClick}>{formatPastTimeShort(lang, timestamp * 1000)}</Link>
      )}
    </div>
  );
};

export default memo(File);
