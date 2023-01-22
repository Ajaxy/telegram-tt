import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiDimensions } from '../../api/types';

import useBuffering from '../../hooks/useBuffering';
import useFullscreen from '../../hooks/useFullscreen';
import usePictureInPicture from '../../hooks/usePictureInPicture';
import useShowTransition from '../../hooks/useShowTransition';
import useVideoCleanup from '../../hooks/useVideoCleanup';
import {
  IS_IOS, IS_SINGLE_COLUMN_LAYOUT, IS_TOUCH_ENV, IS_YA_BROWSER,
} from '../../util/environment';
import safePlay from '../../util/safePlay';
import stopEvent from '../../util/stopEvent';

import Button from '../ui/Button';
import ProgressSpinner from '../ui/ProgressSpinner';
import VideoPlayerControls from './VideoPlayerControls';

import './VideoPlayer.scss';

type OwnProps = {
  url?: string;
  isGif?: boolean;
  posterData?: string;
  posterSize?: ApiDimensions;
  loadProgress?: number;
  fileSize: number;
  isMediaViewerOpen?: boolean;
  noPlay?: boolean;
  volume: number;
  isMuted: boolean;
  isHidden?: boolean;
  playbackRate: number;
  isProtected?: boolean;
  areControlsVisible: boolean;
  shouldCloseOnClick?: boolean;
  toggleControls: (isVisible: boolean) => void;
  onClose: (e: React.MouseEvent<HTMLElement, MouseEvent>) => void;
  isClickDisabled?: boolean;
};

const MOBILE_VERSION_CONTROL_WIDTH = 400;
const MAX_LOOP_DURATION = 30; // Seconds

const VideoPlayer: FC<OwnProps> = ({
  url,
  isGif,
  posterData,
  posterSize,
  loadProgress,
  fileSize,
  isMediaViewerOpen,
  noPlay,
  volume,
  isMuted,
  playbackRate,
  onClose,
  toggleControls,
  areControlsVisible,
  shouldCloseOnClick,
  isProtected,
  isClickDisabled,
}) => {
  const {
    setMediaViewerVolume,
    setMediaViewerMuted,
    setMediaViewerPlaybackRate,
    setMediaViewerHidden,
  } = getActions();
  // eslint-disable-next-line no-null/no-null
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(!IS_TOUCH_ENV || !IS_IOS);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setFullscreen, exitFullscreen] = useFullscreen(videoRef, setIsPlaying);

  const handleEnterFullscreen = useCallback(() => {
    // Yandex browser doesn't support PIP when video is hidden
    if (IS_YA_BROWSER) return;
    setMediaViewerHidden(true);
  }, [setMediaViewerHidden]);

  const handleLeaveFullscreen = useCallback(() => {
    if (IS_YA_BROWSER) return;
    setMediaViewerHidden(false);
  }, [setMediaViewerHidden]);

  const [
    isPictureInPictureSupported,
    enterPictureInPicture,
  ] = usePictureInPicture(videoRef, handleEnterFullscreen, handleLeaveFullscreen);

  const handleVideoMove = useCallback(() => {
    toggleControls(true);
  }, [toggleControls]);

  const handleVideoLeave = useCallback((e) => {
    const bounds = videoRef.current?.getBoundingClientRect();
    if (!bounds) return;
    if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) {
      toggleControls(false);
    }
  }, [toggleControls]);

  const {
    isBuffered, bufferedRanges, bufferingHandlers, bufferedProgress,
  } = useBuffering();
  const {
    shouldRender: shouldRenderSpinner,
    transitionClassNames: spinnerClassNames,
  } = useShowTransition(!isBuffered, undefined, undefined, 'slow');
  const {
    shouldRender: shouldRenderPlayButton,
    transitionClassNames: playButtonClassNames,
  } = useShowTransition(IS_IOS && !isPlaying && !shouldRenderSpinner, undefined, undefined, 'slow');

  useEffect(() => {
    if (noPlay || !isMediaViewerOpen) {
      videoRef.current!.pause();
    } else if (url && !IS_TOUCH_ENV) {
      // Chrome does not automatically start playing when `url` becomes available (even with `autoPlay`),
      // so we force it here. Contrary, iOS does not allow to call `play` without mouse event,
      // so we need to use `autoPlay` instead to allow pre-buffering.
      safePlay(videoRef.current!);
    }
  }, [noPlay, isMediaViewerOpen, url, setMediaViewerMuted]);

  useEffect(() => {
    if (videoRef.current!.currentTime === videoRef.current!.duration) {
      setCurrentTime(0);
      setIsPlaying(false);
    } else {
      setCurrentTime(videoRef.current!.currentTime);
    }
  }, [currentTime]);

  useEffect(() => {
    videoRef.current!.volume = volume;
  }, [volume]);

  useEffect(() => {
    videoRef.current!.playbackRate = playbackRate;
  }, [playbackRate]);

  const togglePlayState = useCallback((e: React.MouseEvent<HTMLElement, MouseEvent> | KeyboardEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      videoRef.current!.pause();
      setIsPlaying(false);
    } else {
      safePlay(videoRef.current!);
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLVideoElement, MouseEvent>) => {
    if (isClickDisabled) return;
    if (shouldCloseOnClick) {
      onClose(e);
    } else {
      togglePlayState(e);
    }
  }, [onClose, shouldCloseOnClick, togglePlayState, isClickDisabled]);

  useVideoCleanup(videoRef, []);

  const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    setCurrentTime(e.currentTarget.currentTime);
  }, []);

  const handleEnded = useCallback(() => {
    setCurrentTime(0);
    setIsPlaying(false);
    toggleControls(true);
  }, [toggleControls]);

  const handleFullscreenChange = useCallback(() => {
    if (isFullscreen && exitFullscreen) {
      exitFullscreen();
    } else if (!isFullscreen && setFullscreen) {
      setFullscreen();
    }
  }, [exitFullscreen, isFullscreen, setFullscreen]);

  const handleSeek = useCallback((position: number) => {
    videoRef.current!.currentTime = position;
  }, []);

  const handleVolumeChange = useCallback((newVolume: number) => {
    setMediaViewerVolume({ volume: newVolume / 100 });
  }, [setMediaViewerVolume]);

  const handleVolumeMuted = useCallback(() => {
    // Browser requires explicit user interaction to keep video playing after unmuting
    videoRef.current!.muted = !videoRef.current!.muted;
    setMediaViewerMuted({ isMuted: !isMuted });
  }, [isMuted, setMediaViewerMuted]);

  const handlePlaybackRateChange = useCallback((newPlaybackRate: number) => {
    setMediaViewerPlaybackRate({ playbackRate: newPlaybackRate });
  }, [setMediaViewerPlaybackRate]);

  useEffect(() => {
    if (!isMediaViewerOpen) return undefined;
    const togglePayingStateBySpace = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        togglePlayState(e);
      }
    };

    document.addEventListener('keydown', togglePayingStateBySpace, false);

    return () => {
      document.removeEventListener('keydown', togglePayingStateBySpace, false);
    };
  }, [togglePlayState, isMediaViewerOpen]);

  const wrapperStyle = posterSize && `width: ${posterSize.width}px; height: ${posterSize.height}px`;
  const videoStyle = `background-image: url(${posterData})`;
  const duration = videoRef.current?.duration || 0;

  return (
    <div
      className="VideoPlayer"
      onMouseMove={!IS_TOUCH_ENV ? handleVideoMove : undefined}
      onMouseOut={!IS_TOUCH_ENV ? handleVideoLeave : undefined}
    >
      <div
        style={wrapperStyle}
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        {isProtected && (
          <div
            onContextMenu={stopEvent}
            onDoubleClick={!IS_TOUCH_ENV ? handleFullscreenChange : undefined}
            onClick={!IS_SINGLE_COLUMN_LAYOUT ? togglePlayState : undefined}
            className="protector"
          />
        )}
        <video
          ref={videoRef}
          autoPlay={IS_TOUCH_ENV}
          controlsList="nodownload"
          playsInline
          loop={isGif || duration <= MAX_LOOP_DURATION}
          // This is to force autoplaying on mobiles
          muted={isGif || isMuted}
          id="media-viewer-video"
          style={videoStyle}
          onPlay={() => setIsPlaying(true)}
          onEnded={handleEnded}
          onClick={!IS_SINGLE_COLUMN_LAYOUT && !isFullscreen ? handleClick : undefined}
          onDoubleClick={!IS_TOUCH_ENV ? handleFullscreenChange : undefined}
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...bufferingHandlers}
          onPause={(e) => {
            setIsPlaying(false);
            bufferingHandlers.onPause(e);
          }}
          onTimeUpdate={handleTimeUpdate}
        >
          {url && <source src={url} />}
        </video>
      </div>
      {shouldRenderPlayButton && (
        <Button round className={`play-button ${playButtonClassNames}`} onClick={togglePlayState}>
          <i className="icon-play" />
        </Button>
      )}
      {shouldRenderSpinner && (
        <div className={['spinner-container', spinnerClassNames].join(' ')}>
          {!isBuffered && <div className="buffering">Buffering...</div>}
          <ProgressSpinner
            size="xl"
            progress={isBuffered ? 1 : loadProgress}
            square
            onClick={onClose}
          />
        </div>
      )}
      {!isGif && !shouldRenderSpinner && (
        <VideoPlayerControls
          isPlaying={isPlaying}
          bufferedRanges={bufferedRanges}
          bufferedProgress={bufferedProgress}
          isBuffered={isBuffered}
          currentTime={currentTime}
          isFullscreenSupported={Boolean(setFullscreen)}
          isPictureInPictureSupported={isPictureInPictureSupported}
          isFullscreen={isFullscreen}
          fileSize={fileSize}
          duration={duration}
          isVisible={areControlsVisible}
          setVisibility={toggleControls}
          isForceMobileVersion={posterSize && posterSize.width < MOBILE_VERSION_CONTROL_WIDTH}
          onSeek={handleSeek}
          onChangeFullscreen={handleFullscreenChange}
          onPictureInPictureChange={enterPictureInPicture}
          onPlayPause={togglePlayState}
          volume={volume}
          playbackRate={playbackRate}
          isMuted={isMuted}
          onVolumeClick={handleVolumeMuted}
          onVolumeChange={handleVolumeChange}
          onPlaybackRateChange={handlePlaybackRateChange}
        />
      )}
    </div>
  );
};

export default memo(VideoPlayer);
