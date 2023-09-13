import type { FC } from '../../lib/teact/teact';
import React, { useEffect, useState } from '../../lib/teact/teact';

import type { TextPart } from '../../types';

import buildClassName from '../../util/buildClassName';
import { throttle } from '../../util/schedulers';
import { IS_TOUCH_ENV } from '../../util/windowEnvironment';
import { REM } from '../common/helpers/mediaDimensions';

import useAppLayout from '../../hooks/useAppLayout';
import useDerivedState from '../../hooks/useDerivedState';
import useControlsSignal from './hooks/useControlsSignal';

import './MediaViewerFooter.scss';

const RESIZE_THROTTLE_MS = 500;

type OwnProps = {
  text: TextPart | TextPart[];
  onClick: () => void;
  isForVideo: boolean;
  isForceMobileVersion?: boolean;
  isProtected?: boolean;
};

const MediaViewerFooter: FC<OwnProps> = ({
  text = '', isForVideo, onClick, isProtected, isForceMobileVersion,
}) => {
  const [isMultiline, setIsMultiline] = useState(false);
  const { isMobile } = useAppLayout();
  const [getIsVisible] = useControlsSignal();
  const isHidden = useDerivedState(() => (IS_TOUCH_ENV ? !getIsVisible() : false), [getIsVisible]);

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
    isForceMobileVersion && 'mobile',
  );

  return (
    <div className={classNames} onClick={stopEvent}>
      {Boolean(text) && (
        <div className="media-viewer-footer-content" onClick={!isMobile ? onClick : undefined}>
          <p className={`media-text custom-scroll allow-selection ${isMultiline ? 'multiline' : ''}`} dir="auto">
            {text}
          </p>
        </div>
      )}
    </div>
  );
};

export default MediaViewerFooter;
