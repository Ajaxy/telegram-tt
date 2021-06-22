import React, {
  FC, memo, useCallback, useEffect, useRef, useState,
} from '../../lib/teact/teact';

import { IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import buildClassName from '../../util/buildClassName';
import usePrevious from '../../hooks/usePrevious';
import useShowTransition from '../../hooks/useShowTransition';
import useLang from '../../hooks/useLang';

import Button from '../ui/Button';

import './ZoomControls.scss';

type OwnProps = {
  isShown: boolean;
  onChangeZoom: (level: number, canCloseZoom?: boolean) => void;
};

export const MAX_ZOOM_LEVEL = 3;
export const MIN_ZOOM_LEVEL = 1;
const ONE_STEP_PERCENT = 100 / (MAX_ZOOM_LEVEL - MIN_ZOOM_LEVEL);
const RESET_ZOOM_LEVEL = 1.5;

const ZoomControls: FC<OwnProps> = ({ isShown, onChangeZoom }) => {
  const { transitionClassNames } = useShowTransition(isShown);
  const prevIsShown = usePrevious<boolean>(isShown);
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const isSeeking = useRef<boolean>(false);

  useEffect(() => {
    if (isShown && !prevIsShown) {
      setZoomLevel(RESET_ZOOM_LEVEL);
    }
  }, [isShown, prevIsShown]);

  const handleZoomOut = () => {
    if (inputRef.current) {
      setZoomLevel(Math.max(MIN_ZOOM_LEVEL, zoomLevel - 0.5));
    }
  };

  const handleZoomIn = () => {
    if (inputRef.current) {
      setZoomLevel(Math.min(MAX_ZOOM_LEVEL, zoomLevel + 0.5));
    }
  };

  const handleStartSeek = useCallback(() => {
    isSeeking.current = true;
  }, []);

  const handleStopSeek = useCallback(() => {
    isSeeking.current = false;
    if (zoomLevel === 1) {
      onChangeZoom(zoomLevel, !isSeeking.current);
    }
  }, [onChangeZoom, zoomLevel]);

  const handleSeeklineChange = (e:React.ChangeEvent<HTMLInputElement>) => {
    setZoomLevel(Math.min(MAX_ZOOM_LEVEL, Math.max(Number(e.target.value), MIN_ZOOM_LEVEL)));
  };

  useEffect(() => {
    onChangeZoom(zoomLevel, !isSeeking.current);
  }, [zoomLevel, onChangeZoom]);

  const lang = useLang();

  const className = buildClassName(
    'ZoomControls',
    transitionClassNames,
  );

  return (
    <div className={className}>
      <Button
        disabled={zoomLevel === MIN_ZOOM_LEVEL}
        size="tiny"
        color="translucent-white"
        ariaLabel={lang('ZoomOut')}
        className="zoom-out"
        ripple={!IS_SINGLE_COLUMN_LAYOUT}
        onClick={handleZoomOut}
      >
        <i className="icon-zoom-out" />
      </Button>
      <Button
        disabled={zoomLevel === MAX_ZOOM_LEVEL}
        size="tiny"
        color="translucent-white"
        ariaLabel="Zoom In"
        className="zoom-in"
        ripple={!IS_SINGLE_COLUMN_LAYOUT}
        onClick={handleZoomIn}
      >
        <i className="icon-zoom-in" />
      </Button>
      <div className="seekline">
        <div className="seekline-track">
          <div
            className="seekline-played"
            // @ts-ignore teact feature
            style={`width: ${(zoomLevel - 1) * ONE_STEP_PERCENT}%`}
          />
          <input
            ref={inputRef}
            min={MIN_ZOOM_LEVEL}
            max={MAX_ZOOM_LEVEL}
            step="0.5"
            value={zoomLevel}
            type="range"
            className="seekline-input"
            onChange={handleSeeklineChange}
            onMouseDown={handleStartSeek}
            onMouseUp={handleStopSeek}
          />
        </div>
      </div>
    </div>
  );
};

export default memo(ZoomControls);
