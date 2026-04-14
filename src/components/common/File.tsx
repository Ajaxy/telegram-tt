import type { ElementRef } from '../../lib/teact/teact';
import {
  memo, useRef,
} from '../../lib/teact/teact';

import type { ApiAttachment, MediaContent } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { IconName } from '../../types/icons';

import buildClassName from '../../util/buildClassName';
import { formatMediaDateTime, formatPastTimeShort } from '../../util/dates/oldDateFormat';
import { getColorFromExtension } from './helpers/documentInfo';
import { getDocumentThumbnailDimensions } from './helpers/mediaDimensions';
import renderText from './helpers/renderText';

import useLang from '../../hooks/useLang';
import useOldLang from '../../hooks/useOldLang';
import useShowTransitionDeprecated from '../../hooks/useShowTransitionDeprecated';

import Link from '../ui/Link';
import ProgressSpinner from '../ui/ProgressSpinner';
import AnimatedFileSize from './AnimatedFileSize';
import CompactMediaPreview, { canRenderCompactMediaPreview } from './CompactMediaPreview';
import Icon from './icons/Icon';

import './File.scss';

type FileSize = 'small' | 'medium' | 'large';

type OwnProps = {
  ref?: ElementRef<HTMLDivElement>;
  id?: string;
  name: string;
  extension?: string;
  size: number;
  timestamp?: number;
  sender?: string;
  previewMedia?: MediaContent;
  previewAttachment?: ApiAttachment;
  observeIntersection?: ObserveFn;
  className?: string;
  previewSize?: FileSize;
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
  previewMedia,
  previewAttachment,
  className,
  previewSize = 'medium',
  isTransferring,
  isUploading,
  isSelectable,
  isSelected,
  transferProgress,
  actionIcon,
  observeIntersection,
  onClick,
  onDateClick,
}: OwnProps) => {
  const oldLang = useOldLang();
  const lang = useLang();
  let elementRef = useRef<HTMLDivElement>();
  if (ref) {
    elementRef = ref;
  }

  const {
    shouldRender: shouldSpinnerRender,
    transitionClassNames: spinnerClassNames,
  } = useShowTransitionDeprecated(isTransferring, undefined, true);

  const color = getColorFromExtension(extension);

  const { width } = getDocumentThumbnailDimensions(previewSize);
  const shouldRenderPreview = canRenderCompactMediaPreview(previewMedia, previewAttachment);

  const fullClassName = buildClassName(
    'File',
    className,
    previewSize !== 'medium' && `size-${previewSize}`,
    onClick && !isUploading && 'interactive',
    isSelected && 'file-is-selected',
  );

  return (
    <div id={id} ref={elementRef} className={fullClassName} dir={lang.isRtl ? 'rtl' : undefined}>
      {isSelectable && (
        <div className="message-select-control no-selection">
          {isSelected && <Icon name="check" className="message-select-control-icon" />}
        </div>
      )}
      <div className="file-icon-container" onClick={isUploading ? undefined : onClick}>
        {shouldRenderPreview ? (
          <CompactMediaPreview
            className="file-preview media-inner"
            media={previewMedia}
            attachment={previewAttachment}
            size={width}
            observeIntersectionForLoading={observeIntersection}
          />
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
              size={previewSize === 'small' ? 's' : 'm'}
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
