import React, {
  FC, memo, useCallback, useEffect, useRef, useState,
} from '../../lib/teact/teact';

import { ApiDimensions } from '../../api/types';

import useBuffering from '../../hooks/useBuffering';
import useFullscreenStatus from '../../hooks/useFullscreen';
import useShowTransition from '../../hooks/useShowTransition';
import useVideoCleanup from '../../hooks/useVideoCleanup';
import { IS_IOS, IS_SINGLE_COLUMN_LAYOUT, IS_TOUCH_ENV } from '../../util/environment';
import safePlay from '../../util/safePlay';

import Button from '../ui/Button';
import ProgressSpinner from '../ui/ProgressSpinner';

import './VideoPlayer.scss';

import VideoPlayerControls from './VideoPlayerControls';

type OwnProps = {
  url?: string;
  isGif?: boolean;
  posterData?: string;
  posterSize?: ApiDimensions;
  loadProgress?: number;
  fileSize: number;
  isMediaViewerOpen?: boolean;
  noPlay?: boolean;
  areControlsVisible: boolean;
  toggleControls: (isVisible: boolean) => void;
  onClose: (e: React.MouseEvent<HTMLElement, MouseEvent>) => void;
};

const MOBILE_VERSION_CONTROL_WIDTH = 400;

const VideoPlayer: FC<OwnProps> = ({
  url,
  isGif,
  posterData,
  posterSize,
  loadProgress,
  fileSize,
  isMediaViewerOpen,
  noPlay,
  onClose,
  toggleControls,
  areControlsVisible,
}) => {
  // eslint-disable-next-line no-null/no-null
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlayed, setIsPlayed] = useState(!IS_TOUCH_ENV || !IS_IOS);
  const [currentTime, setCurrentTime] = useState(0);

  const [isFullscreen, setFullscreen, exitFullscreen] = useFullscreenStatus(videoRef, setIsPlayed);

  const { isBuffered, bufferedProgress, bufferingHandlers } = useBuffering();
  const {
    shouldRender: shouldRenderSpinner,
    transitionClassNames: spinnerClassNames,
  } = useShowTransition(!isBuffered, undefined, undefined, 'slow');
  const {
    shouldRender: shouldRenderPlayButton,
    transitionClassNames: playButtonClassNames,
  } = useShowTransition(IS_IOS && !isPlayed && !shouldRenderSpinner, undefined, undefined, 'slow');

  useEffect(() => {
    if (noPlay || !isMediaViewerOpen) {
      videoRef.current!.pause();
    } else if (url && !IS_TOUCH_ENV) {
      // Chrome does not automatically start playing when `url` becomes available (even with `autoPlay`),
      // so we force it here. Contrary, iOS does not allow to call `play` without mouse event,
      // so we need to use `autoPlay` instead to allow pre-buffering.
      safePlay(videoRef.current!);
    }
  }, [noPlay, isMediaViewerOpen, url]);

  useEffect(() => {
    if (videoRef.current!.currentTime === videoRef.current!.duration) {
      setCurrentTime(0);
      setIsPlayed(false);
    } else {
      setCurrentTime(videoRef.current!.currentTime);
    }
  }, [currentTime]);

  const togglePlayState = useCallback((e: React.MouseEvent<HTMLElement, MouseEvent> | KeyboardEvent) => {
    e.stopPropagation();
    if (isPlayed) {
      videoRef.current!.pause();
      setIsPlayed(false);
    } else {
      safePlay(videoRef.current!);
      setIsPlayed(true);
    }
  }, [isPlayed]);

  useVideoCleanup(videoRef, []);

  const handleMouseMove = useCallback(() => {
    toggleControls(true);
  }, [toggleControls]);

  const handleMouseOut = useCallback((e: React.MouseEvent<HTMLElement, MouseEvent>) => {
    if (e.target === videoRef.current) {
      toggleControls(false);
    }
  }, [toggleControls]);

  const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    setCurrentTime(e.currentTarget.currentTime);
  }, []);

  const handleEnded = useCallback(() => {
    setCurrentTime(0);
    setIsPlayed(false);
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

  useEffect(() => {
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
  }, [togglePlayState]);

  const wrapperStyle = posterSize && `width: ${posterSize.width}px; height: ${posterSize.height}px`;
  const videoStyle = `background-image: url(${posterData})`;

  return (
    <div
      className="VideoPlayer"
      onMouseMove={!isGif && !IS_TOUCH_ENV ? handleMouseMove : undefined}
      onMouseOut={!isGif && !IS_TOUCH_ENV ? handleMouseOut : undefined}
    >
      <div
        style={wrapperStyle}
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          autoPlay={IS_TOUCH_ENV}
          playsInline
          loop={isGif}
          // This is to force auto playing on mobiles
          muted={isGif}
          id="media-viewer-video"
          style={videoStyle}
          onPlay={IS_IOS ? () => setIsPlayed(true) : undefined}
          onEnded={handleEnded}
          onClick={!IS_SINGLE_COLUMN_LAYOUT ? togglePlayState : undefined}
          onDoubleClick={!IS_TOUCH_ENV ? handleFullscreenChange : undefined}
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...bufferingHandlers}
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
          isPlayed={isPlayed}
          bufferedProgress={bufferedProgress}
          currentTime={currentTime}
          isFullscreenSupported={Boolean(setFullscreen)}
          isFullscreen={isFullscreen}
          fileSize={fileSize}
          duration={videoRef.current ? videoRef.current.duration || 0 : 0}
          isVisible={areControlsVisible}
          setVisibility={toggleControls}
          isForceMobileVersion={posterSize && posterSize.width < MOBILE_VERSION_CONTROL_WIDTH}
          onSeek={handleSeek}
          onChangeFullscreen={handleFullscreenChange}
          onPlayPause={togglePlayState}
        />
      )}
    </div>
  );
};

export default memo(VideoPlayer);
