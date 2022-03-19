import React, {
  FC, useEffect, useRef, useCallback,
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
  isForceMobileVersion?: boolean;
  isPlayed: boolean;
  isFullscreenSupported: boolean;
  isFullscreen: boolean;
  onChangeFullscreen: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  onPlayPause: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  isVisible: boolean;
  setVisibility: (isVisible: boolean) => void;
  onSeek: (position: number) => void;
};

const stopEvent = (e: React.MouseEvent<HTMLElement>) => {
  e.stopPropagation();
};

const HIDE_CONTROLS_TIMEOUT_MS = 1500;

const VideoPlayerControls: FC<IProps> = ({
  bufferedProgress,
  currentTime,
  duration,
  fileSize,
  isForceMobileVersion,
  isPlayed,
  isFullscreenSupported,
  isFullscreen,
  onChangeFullscreen,
  onPlayPause,
  isVisible,
  setVisibility,
  onSeek,
}) => {
  // eslint-disable-next-line no-null/no-null
  const seekerRef = useRef<HTMLDivElement>(null);
  const isSeekingRef = useRef<boolean>(false);
  const isSeeking = isSeekingRef.current;

  useEffect(() => {
    let timeout: number | undefined;
    if (!isVisible || !isPlayed || isSeeking) {
      if (timeout) window.clearTimeout(timeout);
      return undefined;
    }
    timeout = window.setTimeout(() => {
      setVisibility(false);
    }, HIDE_CONTROLS_TIMEOUT_MS);
    return () => {
      if (timeout) window.clearTimeout(timeout);
    };
  }, [isPlayed, isVisible, isSeeking, setVisibility]);

  useEffect(() => {
    if (isVisible) {
      document.body.classList.add('video-controls-visible');
    } else {
      document.body.classList.remove('video-controls-visible');
    }
    return () => {
      document.body.classList.remove('video-controls-visible');
    };
  }, [isVisible]);

  const lang = useLang();

  const handleSeek = useCallback((e: MouseEvent | TouchEvent) => {
    if (isSeekingRef.current && seekerRef.current) {
      const {
        width,
        left,
      } = seekerRef.current.getBoundingClientRect();
      const clientX = e instanceof MouseEvent ? e.clientX : e.targetTouches[0].clientX;
      onSeek(Math.max(Math.min(duration * ((clientX - left) / width), duration), 0));
    }
  }, [duration, onSeek]);

  const handleStartSeek = useCallback((e: MouseEvent | TouchEvent) => {
    isSeekingRef.current = true;
    handleSeek(e);
  }, [handleSeek]);

  const handleStopSeek = useCallback(() => {
    isSeekingRef.current = false;
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

  return (
    <div
      className={buildClassName('VideoPlayerControls', isForceMobileVersion && 'mobile', isVisible && 'active')}
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
