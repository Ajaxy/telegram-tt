import React, { FC, useState, useEffect } from '../../lib/teact/teact';

import { IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import { formatMediaDuration } from '../../util/dateFormat';
import formatFileSize from './helpers/formatFileSize';
import useLang from '../../hooks/useLang';

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
  onSeek: OnChangeHandler;
};

type OnChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => void;

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

  if (!isVisible && !isForceVisible) {
    return undefined;
  }

  return (
    <div className={`VideoPlayerControls ${isForceMobileVersion ? 'mobile' : ''}`} onClick={stopEvent}>
      {renderSeekLine(currentTime, duration, bufferedProgress, onSeek)}
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

function renderFileSize(downloadedPercent: number, totalSize: number) {
  return (
    <div className="player-file-size">
      {`${formatFileSize(totalSize * downloadedPercent)} / ${formatFileSize(totalSize)}`}
    </div>
  );
}

function renderSeekLine(currentTime: number, duration: number, bufferedProgress: number, onSeek: OnChangeHandler) {
  const percentagePlayed = (currentTime / duration) * 100;
  const percentageBuffered = bufferedProgress * 100;

  return (
    <div className="player-seekline">
      <div className="player-seekline-track">
        <div
          className="player-seekline-buffered"
          // @ts-ignore teact feature
          style={`width: ${percentageBuffered || 0}%`}
        />
        <div
          className="player-seekline-played"
          // @ts-ignore teact feature
          style={`width: ${percentagePlayed || 0}%`}
        />
        <input
          min="0"
          max="100"
          step={0.01}
          type="range"
          onInput={onSeek}
          className="player-seekline-input"
          value={percentagePlayed || 0}
        />
      </div>
    </div>
  );
}

export default VideoPlayerControls;
