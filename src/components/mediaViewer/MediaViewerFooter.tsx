import type { FC } from '../../lib/teact/teact';
import React, { useEffect, useState } from '../../lib/teact/teact';

import type { TextPart } from '../../types';

import { REM } from '../common/helpers/mediaDimensions';
import { throttle } from '../../util/schedulers';
import buildClassName from '../../util/buildClassName';
import useAppLayout from '../../hooks/useAppLayout';

import './MediaViewerFooter.scss';

const RESIZE_THROTTLE_MS = 500;

type OwnProps = {
  text: TextPart | TextPart[];
  onClick: () => void;
  isHidden?: boolean;
  isForVideo: boolean;
  isProtected?: boolean;
};

const MediaViewerFooter: FC<OwnProps> = ({
  text = '', isHidden, isForVideo, onClick, isProtected,
}) => {
  const [isMultiline, setIsMultiline] = useState(false);
  const { isMobile } = useAppLayout();

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
    isProtected && 'is-protected',
  );

  return (
    <div className={classNames} onClick={stopEvent}>
      {Boolean(text) && (
        <div className="media-viewer-footer-content" onClick={!isMobile ? onClick : undefined}>
          <p className={`media-text custom-scroll ${isMultiline ? 'multiline' : ''}`} dir="auto">{text}</p>
        </div>
      )}
    </div>
  );
};

export default MediaViewerFooter;
