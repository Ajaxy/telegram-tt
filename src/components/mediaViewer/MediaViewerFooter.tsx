import React, { FC, useEffect, useState } from '../../lib/teact/teact';
import { throttle } from '../../util/schedulers';
import { TextPart } from '../common/helpers/renderMessageText';
import { REM } from '../common/helpers/mediaDimensions';

import './MediaViewerFooter.scss';

const RESIZE_THROTTLE_MS = 500;

type OwnProps = {
  text: TextPart | TextPart[];
  onClick: () => void;
  isHideable: boolean;
};

const MediaViewerFooter: FC<OwnProps> = ({ text = '', isHideable, onClick }) => {
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

  return (
    <div className={`MediaViewerFooter ${isHideable ? 'hideable' : ''}`} onClick={stopEvent}>
      {text && (
        <div className="media-viewer-footer-content" onClick={onClick}>
          <p className={`media-text custom-scroll ${isMultiline ? 'multiline' : ''}`} dir="auto">{text}</p>
        </div>
      )}
    </div>
  );
};

export default MediaViewerFooter;
