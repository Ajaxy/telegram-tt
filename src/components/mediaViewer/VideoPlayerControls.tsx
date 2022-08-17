import type { FC } from '../../lib/teact/teact';
import React, {
  useEffect, useRef, useCallback, useMemo,
} from '../../lib/teact/teact';
import buildClassName from '../../util/buildClassName';

import useFlag from '../../hooks/useFlag';
import { IS_IOS, IS_SINGLE_COLUMN_LAYOUT, IS_TOUCH_ENV } from '../../util/environment';
import { formatMediaDuration } from '../../util/dateFormat';
import { formatFileSize } from '../../util/textFormat';
import useLang from '../../hooks/useLang';
import type { BufferedRange } from '../../hooks/useBuffering';
import { captureEvents } from '../../util/captureEvents';

import Button from '../ui/Button';
import RangeSlider from '../ui/RangeSlider';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';

import './VideoPlayerControls.scss';

type OwnProps = {
  bufferedRanges: BufferedRange[];
  bufferedProgress: number;
  currentTime: number;
  duration: number;
  fileSize: number;
  isForceMobileVersion?: boolean;
  isPlayed: boolean;
  isFullscreenSupported: boolean;
  isFullscreen: boolean;
  isVisible: boolean;
  isBuffered: boolean;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  onChangeFullscreen: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  onVolumeClick: () => void;
  onVolumeChange: (volume: number) => void;
  onPlaybackRateChange: (playbackRate: number) => void;
  onPlayPause: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  setVisibility: (isVisible: boolean) => void;
  onSeek: (position: number) => void;
};

const stopEvent = (e: React.MouseEvent<HTMLElement>) => {
  e.stopPropagation();
};

const PLAYBACK_RATES = [
  0.5,
  1,
  1.5,
  2,
];

const HIDE_CONTROLS_TIMEOUT_MS = 3000;

const VideoPlayerControls: FC<OwnProps> = ({
  bufferedRanges,
  bufferedProgress,
  currentTime,
  duration,
  fileSize,
  isForceMobileVersion,
  isPlayed,
  isFullscreenSupported,
  isFullscreen,
  isVisible,
  isBuffered,
  volume,
  isMuted,
  playbackRate,
  onChangeFullscreen,
  onVolumeClick,
  onVolumeChange,
  onPlaybackRateChange,
  onPlayPause,
  setVisibility,
  onSeek,
}) => {
  const [isPlaybackMenuOpen, openPlaybackMenu, closePlaybackMenu] = useFlag();
  // eslint-disable-next-line no-null/no-null
  const seekerRef = useRef<HTMLDivElement>(null);
  const isSeekingRef = useRef<boolean>(false);
  const isSeeking = isSeekingRef.current;

  useEffect(() => {
    if (!IS_TOUCH_ENV) return undefined;
    let timeout: number | undefined;
    if (!isVisible || !isPlayed || isSeeking || isPlaybackMenuOpen) {
      if (timeout) window.clearTimeout(timeout);
      return undefined;
    }
    timeout = window.setTimeout(() => {
      setVisibility(false);
    }, HIDE_CONTROLS_TIMEOUT_MS);
    return () => {
      if (timeout) window.clearTimeout(timeout);
    };
  }, [isPlayed, isVisible, isSeeking, setVisibility, isPlaybackMenuOpen]);

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

  useEffect(() => {
    if (!isVisible) {
      closePlaybackMenu();
    }
  }, [closePlaybackMenu, isVisible]);

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

  const volumeIcon = useMemo(() => {
    if (volume === 0 || isMuted) return 'icon-muted';
    if (volume < 0.3) return 'icon-volume-1';
    if (volume < 0.6) return 'icon-volume-2';
    return 'icon-volume-3';
  }, [volume, isMuted]);

  return (
    <div
      className={buildClassName('VideoPlayerControls', isForceMobileVersion && 'mobile', isVisible && 'active')}
      onClick={stopEvent}
    >
      {renderSeekLine(currentTime, duration, bufferedRanges, seekerRef)}
      <div className="buttons">
        <Button
          ariaLabel={lang('AccActionPlay')}
          size="tiny"
          ripple={!IS_SINGLE_COLUMN_LAYOUT}
          color="translucent-white"
          className="play"
          round
          onClick={onPlayPause}
        >
          <i className={isPlayed ? 'icon-pause' : 'icon-play'} />
        </Button>
        <Button
          ariaLabel="Volume"
          size="tiny"
          color="translucent-white"
          className="volume"
          round
          onClick={onVolumeClick}
        >
          <i className={volumeIcon} />
        </Button>
        {!IS_IOS && (
          <RangeSlider bold className="volume-slider" value={isMuted ? 0 : volume * 100} onChange={onVolumeChange} />
        )}
        {renderTime(currentTime, duration)}
        {!isBuffered && (
          <div className="player-file-size">
            {`${formatFileSize(lang, fileSize * bufferedProgress)} / ${formatFileSize(lang, fileSize)}`}
          </div>
        )}
        <div className="spacer" />
        <Button
          ariaLabel="Playback rate"
          size="tiny"
          color="translucent-white"
          className="playback-rate"
          round
          onClick={openPlaybackMenu}
        >
          {`${playbackRate}x`}
        </Button>
        {isFullscreenSupported && (
          <Button
            ariaLabel="Fullscreen"
            size="tiny"
            color="translucent-white"
            className="fullscreen"
            round
            onClick={onChangeFullscreen}
          >
            <i className={isFullscreen ? 'icon-smallscreen' : 'icon-fullscreen'} />
          </Button>
        )}
      </div>
      <Menu
        isOpen={isPlaybackMenuOpen}
        className={buildClassName('playback-rate-menu', !isFullscreenSupported && 'no-fullscreen')}
        positionX="right"
        positionY="bottom"
        autoClose
        onClose={closePlaybackMenu}
      >
        {PLAYBACK_RATES.map((rate) => (
          // eslint-disable-next-line react/jsx-no-bind
          <MenuItem disabled={playbackRate === rate} onClick={() => onPlaybackRateChange(rate)}>
            {`${rate}x`}
          </MenuItem>
        ))}
      </Menu>
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

function renderSeekLine(
  currentTime: number, duration: number, bufferedRanges: BufferedRange[], seekerRef: React.RefObject<HTMLDivElement>,
) {
  const percentagePlayed = (currentTime / duration) * 100;

  return (
    <div className="player-seekline" ref={seekerRef}>
      <div className="player-seekline-track">
        {bufferedRanges.map(({ start, end }) => (
          <div
            className="player-seekline-buffered"
            style={`left: ${start * 100}%; right: ${100 - end * 100}%`}
          />
        ))}
        <div
          className="player-seekline-played"
          style={`width: ${percentagePlayed || 0}%`}
        />
      </div>
    </div>
  );
}

export default VideoPlayerControls;
