import type { ElementRef } from '../../lib/teact/teact';
import {
  memo, useRef, useState,
} from '../../lib/teact/teact';

import type { IconName } from '../../types/icons';

import { IS_CANVAS_FILTER_SUPPORTED } from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';
import { formatMediaDateTime, formatPastTimeShort } from '../../util/dates/dateFormat';
import { getColorFromExtension } from './helpers/documentInfo';
import { getDocumentThumbnailDimensions } from './helpers/mediaDimensions';
import renderText from './helpers/renderText';

import useAppLayout from '../../hooks/useAppLayout';
import useCanvasBlur from '../../hooks/useCanvasBlur';
import useLang from '../../hooks/useLang';
import useMediaTransitionDeprecated from '../../hooks/useMediaTransitionDeprecated';
import useOldLang from '../../hooks/useOldLang';
import useShowTransitionDeprecated from '../../hooks/useShowTransitionDeprecated';

import Link from '../ui/Link';
import ProgressSpinner from '../ui/ProgressSpinner';
import AnimatedFileSize from './AnimatedFileSize';
import Icon from './icons/Icon';

import './File.scss';

type OwnProps = {
  ref?: ElementRef<HTMLDivElement>;
  id?: string;
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

const File = ({
  ref,
  id,
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
}: OwnProps) => {
  const oldLang = useOldLang();
  const lang = useLang();
  let elementRef = useRef<HTMLDivElement>();
  if (ref) {
    elementRef = ref;
  }

  const { isMobile } = useAppLayout();
  const [withThumb] = useState(!previewData);
  const noThumb = Boolean(previewData);
  const thumbRef = useCanvasBlur(thumbnailDataUri, noThumb, isMobile && !IS_CANVAS_FILTER_SUPPORTED);
  const thumbClassNames = useMediaTransitionDeprecated(!noThumb);

  const {
    shouldRender: shouldSpinnerRender,
    transitionClassNames: spinnerClassNames,
  } = useShowTransitionDeprecated(isTransferring, undefined, true);

  const color = getColorFromExtension(extension);

  const { width, height } = getDocumentThumbnailDimensions(smaller);

  const fullClassName = buildClassName(
    'File',
    className,
    smaller && 'smaller',
    onClick && !isUploading && 'interactive',
    isSelected && 'file-is-selected',
  );

  return (
    <div id={id} ref={elementRef} className={fullClassName} dir={lang.isRtl ? 'rtl' : undefined}>
      {isSelectable && (
        <div className="message-select-control no-selection">
          {isSelected && <Icon name="select" />}
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
          <Icon
            name={actionIcon || 'download'}
            className={buildClassName('action-icon', shouldSpinnerRender && 'hidden')}
          />
        )}
      </div>
      <div className="file-info">
        <div className="file-title" dir="auto" title={name}>{renderText(name)}</div>
        <div className="file-subtitle" dir="auto">
          <AnimatedFileSize size={size} progress={isTransferring ? transferProgress : undefined} />
          {sender && (
            <>
              <span className="bullet">&bull;</span>
              <span className="file-sender">{renderText(sender)}</span>
            </>
          )}
          {!sender && Boolean(timestamp) && (
            <>
              <span className="bullet">&bull;</span>
              <Link onClick={onDateClick}>{formatMediaDateTime(oldLang, timestamp * 1000, true)}</Link>
            </>
          )}
        </div>
      </div>
      {sender && Boolean(timestamp) && (
        <Link onClick={onDateClick}>{formatPastTimeShort(oldLang, timestamp * 1000)}</Link>
      )}
    </div>
  );
};

export default memo(File);
