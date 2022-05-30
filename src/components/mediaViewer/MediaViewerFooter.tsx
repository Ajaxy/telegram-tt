import type { FC } from '../../lib/teact/teact';
import React, { useEffect, useState } from '../../lib/teact/teact';

import type { TextPart } from '../../types';

import { IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import { throttle } from '../../util/schedulers';
import buildClassName from '../../util/buildClassName';
import { REM } from '../common/helpers/mediaDimensions';

import './MediaViewerFooter.scss';

const RESIZE_THROTTLE_MS = 500;

type OwnProps = {
  text: TextPart | TextPart[];
  onClick: () => void;
  isHidden?: boolean;
  isForVideo: boolean;
};

const MediaViewerFooter: FC<OwnProps> = ({
  text = '', isHidden, isForVideo, onClick,
}) => {
  const [isMultiline, setIsMultiline] = useState(false);
  useEffect(() => {
    const footerContent = document.querySelector('.MediaViewerFooter .media-text') as HTMLDivElement | null;

    const checkIsMultiline = () => {
      const height = footerContent ? footerContent.clientHeight : 0;

      setIsMultiline(height > REM * 2);
    };

    // First run for initial detection of multiline footer text
    checkIsMultiline();

    const handleResize = throttle(checkIsMultiline, RESIZE_THROTTLE_MS, true);

    window.addEventListener('resize', handleResize, false);

    return () => {
      window.removeEventListener('resize', handleResize, false);
    };
  }, []);

  function stopEvent(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (text) {
      e.stopPropagation();
    }
  }

  const classNames = buildClassName(
    'MediaViewerFooter',
    isForVideo && 'is-for-video',
    isHidden && 'is-hidden',
  );

  return (
    <div className={classNames} onClick={stopEvent}>
      {text && (
        <div className="media-viewer-footer-content" onClick={!IS_SINGLE_COLUMN_LAYOUT ? onClick : undefined}>
          <p className={`media-text custom-scroll ${isMultiline ? 'multiline' : ''}`} dir="auto">{text}</p>
        </div>
      )}
    </div>
  );
};

export default MediaViewerFooter;
