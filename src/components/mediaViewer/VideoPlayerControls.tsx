import React, {
  FC, useState, useEffect, useRef, useCallback,
} from '../../lib/teact/teact';
import buildClassName from '../../util/buildClassName';

import { IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import { formatMediaDuration } from '../../util/dateFormat';
import formatFileSize from './helpers/formatFileSize';
import useLang from '../../hooks/useLang';
import { captureEvents } from '../../util/captureEvents';

import Button from '../ui/Button';

import './VideoPlayerControls.scss';

type IProps = {
  bufferedProgress: number;
  currentTime: number;
  duration: number;
  fileSize: number;
  isForceVisible: boolean;
  isForceMobileVersion?: boolean;
  isPlayed: boolean;
  isFullscreenSupported: boolean;
  isFullscreen: boolean;
  onChangeFullscreen: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  onPlayPause: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  onSeek: (position: number) => void;
};

const stopEvent = (e: React.MouseEvent<HTMLElement>) => {
  e.stopPropagation();
};

const HIDE_CONTROLS_TIMEOUT_MS = 800;

const VideoPlayerControls: FC<IProps> = ({
  bufferedProgress,
  currentTime,
  duration,
  fileSize,
  isForceVisible,
  isForceMobileVersion,
  isPlayed,
  isFullscreenSupported,
  isFullscreen,
  onChangeFullscreen,
  onPlayPause,
  onSeek,
}) => {
  const [isVisible, setVisibility] = useState(true);
  // eslint-disable-next-line no-null/no-null
  const seekerRef = useRef<HTMLDivElement>(null);
  const isSeeking = useRef<boolean>(false);

  useEffect(() => {
    if (isForceVisible) {
      setVisibility(isForceVisible);
    }
  }, [isForceVisible]);

  useEffect(() => {
    let timeout: number | undefined;

    if (!isForceVisible) {
      if (IS_SINGLE_COLUMN_LAYOUT) {
        setVisibility(false);
      } else {
        timeout = window.setTimeout(() => {
          setVisibility(false);
        }, HIDE_CONTROLS_TIMEOUT_MS);
      }
    }

    return () => {
      if (timeout) {
        window.clearTimeout(timeout);
      }
    };
  }, [isForceVisible]);

  useEffect(() => {
    if (isVisible || isForceVisible) {
      document.body.classList.add('video-controls-visible');
    }

    return () => {
      document.body.classList.remove('video-controls-visible');
    };
  }, [isForceVisible, isVisible]);

  const lang = useLang();

  const handleSeek = useCallback((e: MouseEvent | TouchEvent) => {
    if (isSeeking.current && seekerRef.current) {
      const { width, left } = seekerRef.current.getBoundingClientRect();
      const clientX = e instanceof MouseEvent ? e.clientX : e.targetTouches[0].clientX;
      onSeek(Math.max(Math.min(duration * ((clientX - left) / width), duration), 0));
    }
  }, [duration, onSeek]);

  const handleStartSeek = useCallback((e: MouseEvent | TouchEvent) => {
    isSeeking.current = true;
    handleSeek(e);
  }, [handleSeek]);

  const handleStopSeek = useCallback(() => {
    isSeeking.current = false;
  }, []);

  useEffect(() => {
    if (!seekerRef.current || !isVisible) return undefined;
    return captureEvents(seekerRef.current, {
      onCapture: handleStartSeek,
      onRelease: handleStopSeek,
      onClick: handleStopSeek,
      onDrag: handleSeek,
    });
  }, [isVisible, handleStartSeek, handleSeek, handleStopSeek]);

  const isActive = isVisible || isForceVisible;

  return (
    <div
      className={buildClassName('VideoPlayerControls', isForceMobileVersion && 'mobile', isActive && 'active')}
      onClick={stopEvent}
    >
      {renderSeekLine(currentTime, duration, bufferedProgress, seekerRef)}
      <Button
        ariaLabel={lang('AccActionPlay')}
        size="tiny"
        ripple={!IS_SINGLE_COLUMN_LAYOUT}
        color="translucent-white"
        className="play"
        onClick={onPlayPause}
      >
        <i className={isPlayed ? 'icon-pause' : 'icon-play'} />
      </Button>
      {renderTime(currentTime, duration)}
      {bufferedProgress < 1 && renderFileSize(bufferedProgress, fileSize)}
      {isFullscreenSupported && (
        <Button
          ariaLabel="Fullscreen"
          size="tiny"
          color="translucent-white"
          className="fullscreen"
          onClick={onChangeFullscreen}
        >
          <i className={`${isFullscreen ? 'icon-smallscreen' : 'icon-fullscreen'}`} />
        </Button>
      )}
    </div>
  );
};

function renderTime(currentTime: number, duration: number) {
  return (
    <div className="player-time">
      {`${formatMediaDuration(currentTime)} / ${formatMediaDuration(duration)}`}
    </div>
  );
}

function renderFileSize(loadedPercent: number, totalSize: number) {
  return (
    <div className="player-file-size">
      {`${formatFileSize(totalSize * loadedPercent)} / ${formatFileSize(totalSize)}`}
    </div>
  );
}

function renderSeekLine(
  currentTime: number, duration: number, bufferedProgress: number, seekerRef: React.RefObject<HTMLDivElement>,
) {
  const percentagePlayed = (currentTime / duration) * 100;
  const percentageBuffered = bufferedProgress * 100;

  return (
    <div className="player-seekline" ref={seekerRef}>
      <div className="player-seekline-track">
        <div
          className="player-seekline-buffered"
          style={`width: ${percentageBuffered || 0}%`}
        />
        <div
          className="player-seekline-played"
          style={`width: ${percentagePlayed || 0}%`}
        />
      </div>
    </div>
  );
}

export default VideoPlayerControls;
