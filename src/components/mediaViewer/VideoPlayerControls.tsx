import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useLayoutEffect,
  useMemo,
} from '../../lib/teact/teact';

import type { ApiDimensions } from '../../api/types';
import type { BufferedRange } from '../../hooks/useBuffering';

import buildClassName from '../../util/buildClassName';
import { formatMediaDuration } from '../../util/dateFormat';
import { formatFileSize } from '../../util/textFormat';
import { IS_IOS, IS_TOUCH_ENV } from '../../util/windowEnvironment';

import useAppLayout from '../../hooks/useAppLayout';
import useCurrentTimeSignal from '../../hooks/useCurrentTimeSignal';
import useDerivedState from '../../hooks/useDerivedState';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useSignal from '../../hooks/useSignal';
import useControlsSignal from './hooks/useControlsSignal';

import Button from '../ui/Button';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import RangeSlider from '../ui/RangeSlider';
import SeekLine from './SeekLine';

import './VideoPlayerControls.scss';

type OwnProps = {
  url?: string;
  bufferedRanges: BufferedRange[];
  bufferedProgress: number;
  duration: number;
  isReady: boolean;
  fileSize: number;
  isForceMobileVersion?: boolean;
  isPlaying: boolean;
  isFullscreenSupported: boolean;
  isPictureInPictureSupported: boolean;
  isFullscreen: boolean;
  isPreviewDisabled?: boolean;
  isBuffered: boolean;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  posterSize?: ApiDimensions;
  onChangeFullscreen: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  onPictureInPictureChange?: () => void;
  onVolumeClick: () => void;
  onVolumeChange: (volume: number) => void;
  onPlaybackRateChange: (playbackRate: number) => void;
  onPlayPause: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
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
  2.5,
  3,
];

const HIDE_CONTROLS_TIMEOUT_MS = 3000;

const VideoPlayerControls: FC<OwnProps> = ({
  url,
  bufferedRanges,
  bufferedProgress,
  duration,
  isReady,
  fileSize,
  isForceMobileVersion,
  isPlaying,
  isFullscreenSupported,
  isFullscreen,
  isBuffered,
  isPreviewDisabled,
  volume,
  isMuted,
  playbackRate,
  posterSize,
  onChangeFullscreen,
  onVolumeClick,
  onVolumeChange,
  onPlaybackRateChange,
  isPictureInPictureSupported,
  onPictureInPictureChange,
  onPlayPause,
  onSeek,
}) => {
  const [isPlaybackMenuOpen, openPlaybackMenu, closePlaybackMenu] = useFlag();
  const [getCurrentTime] = useCurrentTimeSignal();
  const currentTime = useDerivedState(() => Math.trunc(getCurrentTime()), [getCurrentTime]);
  const [getIsSeeking, setIsSeeking] = useSignal(false);

  const { isMobile } = useAppLayout();
  const [getIsVisible, setVisibility] = useControlsSignal();
  const isVisible = useDerivedState(getIsVisible);

  useEffect(() => {
    if (!IS_TOUCH_ENV && !isForceMobileVersion) return undefined;
    let timeout: number | undefined;
    if (!isVisible || !isPlaying || isPlaybackMenuOpen || getIsSeeking()) {
      if (timeout) window.clearTimeout(timeout);
      return undefined;
    }
    timeout = window.setTimeout(() => {
      setVisibility(false);
    }, HIDE_CONTROLS_TIMEOUT_MS);
    return () => {
      if (timeout) window.clearTimeout(timeout);
    };
  }, [isPlaying, isVisible, setVisibility, isPlaybackMenuOpen, getIsSeeking, isForceMobileVersion]);

  useLayoutEffect(() => {
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

  const handleSeek = useLastCallback((position: number) => {
    setIsSeeking(false);
    onSeek(position);
  });

  const handleSeekStart = useLastCallback(() => {
    setIsSeeking(true);
  });

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
      <SeekLine
        url={url}
        duration={duration}
        isReady={isReady}
        isPlaying={isPlaying}
        isPreviewDisabled={isPreviewDisabled}
        posterSize={posterSize}
        bufferedRanges={bufferedRanges}
        playbackRate={playbackRate}
        onSeek={handleSeek}
        onSeekStart={handleSeekStart}
        isActive={isVisible}
      />
      <div className="buttons">
        <Button
          ariaLabel={lang('AccActionPlay')}
          size="tiny"
          ripple={!isMobile}
          color="translucent-white"
          className="play"
          round
          onClick={onPlayPause}
        >
          <i className={buildClassName('icon', isPlaying ? 'icon-pause' : 'icon-play')} />
        </Button>
        <Button
          ariaLabel="Volume"
          size="tiny"
          color="translucent-white"
          className="volume"
          round
          onClick={onVolumeClick}
        >
          <i className={buildClassName('icon', volumeIcon)} />
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
        {isPictureInPictureSupported && (
          <Button
            ariaLabel="Picture in picture"
            size="tiny"
            color="translucent-white"
            className="fullscreen"
            round
            onClick={onPictureInPictureChange}
          >
            <i className="icon icon-pip" />
          </Button>
        )}
        {isFullscreenSupported && (
          <Button
            ariaLabel="Fullscreen"
            size="tiny"
            color="translucent-white"
            className="fullscreen"
            round
            onClick={onChangeFullscreen}
          >
            <i className={buildClassName('icon ', isFullscreen ? 'icon-smallscreen' : 'icon-fullscreen')} />
          </Button>
        )}
      </div>
      <Menu
        isOpen={isPlaybackMenuOpen}
        className={buildClassName(
          'playback-rate-menu',
          !isFullscreenSupported && 'no-fullscreen',
          !isPictureInPictureSupported && 'no-pip',
        )}
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

export default memo(VideoPlayerControls);
