import type { FC } from '../../lib/teact/teact';
import type React from '../../lib/teact/teact';
import {
  memo, useEffect, useRef, useSignal, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiDimensions, StoryboardInfo } from '../../api/types';

import { IS_IOS, IS_TOUCH_ENV, IS_YA_BROWSER } from '../../util/browser/windowEnvironment';
import getPointerPosition from '../../util/events/getPointerPosition';
import { clamp } from '../../util/math';
import safePlay from '../../util/safePlay';
import stopEvent from '../../util/stopEvent';

import useUnsupportedMedia from '../../hooks/media/useUnsupportedMedia';
import useAppLayout from '../../hooks/useAppLayout';
import useBuffering from '../../hooks/useBuffering';
import useCurrentTimeSignal from '../../hooks/useCurrentTimeSignal';
import useLastCallback from '../../hooks/useLastCallback';
import usePictureInPicture from '../../hooks/usePictureInPicture';
import useShowTransitionDeprecated from '../../hooks/useShowTransitionDeprecated';
import useVideoCleanup from '../../hooks/useVideoCleanup';
import useFullscreen from '../../hooks/window/useFullscreen';
import useControlsSignal from './hooks/useControlsSignal';
import useVideoWaitingSignal from './hooks/useVideoWaitingSignal';

import Button from '../ui/Button';
import ProgressSpinner from '../ui/ProgressSpinner';
import VideoPlayerControls from './VideoPlayerControls';

import './VideoPlayer.scss';

type OwnProps = {
  url?: string;
  storyboardInfo?: StoryboardInfo;
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
  shouldCloseOnClick?: boolean;
  isForceMobileVersion?: boolean;
  isClickDisabled?: boolean;
  isSponsoredMessage?: boolean;
  timestamp?: number;
  handleSponsoredClick?: (isFromMedia?: boolean) => void;
  onClose: (e: React.MouseEvent<HTMLElement, MouseEvent>) => void;
};

const MAX_LOOP_DURATION = 30; // Seconds
const MIN_READY_STATE = 4;
const REWIND_STEP = 5; // Seconds

const VideoPlayer: FC<OwnProps> = ({
  url,
  storyboardInfo,
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
  isForceMobileVersion,
  shouldCloseOnClick,
  isProtected,
  isClickDisabled,
  isSponsoredMessage,
  timestamp,
  handleSponsoredClick,
  onClose,
}) => {
  const {
    setMediaViewerVolume,
    setMediaViewerMuted,
    setMediaViewerPlaybackRate,
    setMediaViewerHidden,
  } = getActions();
  const videoRef = useRef<HTMLVideoElement>();
  const [isPlaying, setIsPlaying] = useState(!IS_TOUCH_ENV || !IS_IOS);
  const [isFullscreen, setFullscreen, exitFullscreen] = useFullscreen(videoRef, setIsPlaying);
  const { isMobile } = useAppLayout();
  const duration = videoRef.current?.duration || 0;
  const isLooped = isGif || duration <= MAX_LOOP_DURATION;

  const handleEnterFullscreen = useLastCallback(() => {
    // Yandex browser doesn't support PIP when video is hidden
    if (IS_YA_BROWSER) return;
    setMediaViewerHidden({ isHidden: true });
  });

  const handleLeaveFullscreen = useLastCallback(() => {
    if (IS_YA_BROWSER) return;
    setMediaViewerHidden({ isHidden: false });
  });

  const [
    isPictureInPictureSupported,
    enterPictureInPicture,
    isInPictureInPicture,
  ] = usePictureInPicture(videoRef, handleEnterFullscreen, handleLeaveFullscreen);

  const [, toggleControls, lockControls] = useControlsSignal();
  const [getIsSeeking, setIsSeeking] = useSignal(false);
  const lastMousePosition = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const updateMousePosition = (e: MouseEvent | TouchEvent) => {
      lastMousePosition.current = getPointerPosition(e);
    };

    window.addEventListener('mousemove', updateMousePosition);
    window.addEventListener('touchmove', updateMousePosition);

    return () => {
      window.removeEventListener('mousemove', updateMousePosition);
      window.removeEventListener('touchmove', updateMousePosition);
    };
  }, []);

  const checkMousePositionAndToggleControls = useLastCallback((clientX: number, clientY: number) => {
    const bounds = videoRef.current?.getBoundingClientRect();
    if (!bounds) return;
    if (clientX <= bounds.left || clientX >= bounds.right
      || clientY <= bounds.top || clientY >= bounds.bottom) {
      if (!getIsSeeking()) {
        toggleControls(false);
      }
    }
  });

  const handleVideoMove = useLastCallback(() => {
    toggleControls(true);
  });

  const handleVideoLeave = useLastCallback((e) => {
    checkMousePositionAndToggleControls(e.clientX, e.clientY);
  });

  const handleSeekingChange = useLastCallback((isSeeking: boolean) => {
    setIsSeeking(isSeeking);
    if (!isSeeking) {
      const { x, y } = lastMousePosition.current;
      checkMousePositionAndToggleControls(x, y);
    }
  });

  const {
    isReady, isBuffered, bufferedRanges, bufferingHandlers, bufferedProgress,
  } = useBuffering();
  const isUnsupported = useUnsupportedMedia(videoRef, undefined, !url);

  const {
    shouldRender: shouldRenderSpinner,
    transitionClassNames: spinnerClassNames,
  } = useShowTransitionDeprecated(
    !isBuffered && !isUnsupported, undefined, undefined, 'slow',
  );
  const {
    shouldRender: shouldRenderPlayButton,
    transitionClassNames: playButtonClassNames,
  } = useShowTransitionDeprecated(
    IS_IOS && !isPlaying && !shouldRenderSpinner && !isUnsupported, undefined, undefined, 'slow',
  );

  const [, setCurrentTime] = useCurrentTimeSignal();
  const [, setIsVideoWaiting] = useVideoWaitingSignal();

  useEffect(() => {
    lockControls(shouldRenderSpinner);
  }, [lockControls, shouldRenderSpinner]);

  useEffect(() => {
    if (noPlay || !isMediaViewerOpen || isUnsupported) {
      videoRef.current!.pause();
    } else if (url && !IS_TOUCH_ENV) {
      // Chrome does not automatically start playing when `url` becomes available (even with `autoPlay`),
      // so we force it here. Contrary, iOS does not allow to call `play` without mouse event,
      // so we need to use `autoPlay` instead to allow pre-buffering.
      safePlay(videoRef.current!);
    }
  }, [noPlay, isMediaViewerOpen, url, setMediaViewerMuted, isUnsupported]);

  useEffect(() => {
    videoRef.current!.volume = volume;
  }, [volume]);

  useEffect(() => {
    videoRef.current!.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    if (!timestamp) return;
    videoRef.current!.currentTime = timestamp;
    setCurrentTime(timestamp);
  }, [setCurrentTime, timestamp]);

  const togglePlayState = useLastCallback((e: React.MouseEvent<HTMLElement, MouseEvent> | KeyboardEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      videoRef.current!.pause();
      setIsPlaying(false);
    } else {
      safePlay(videoRef.current!);
      setIsPlaying(true);
    }
  });

  const handleClick = useLastCallback((e: React.MouseEvent<HTMLVideoElement, MouseEvent>) => {
    if (isSponsoredMessage) {
      handleSponsoredClick?.(true);
      onClose(e);
    }
    if (isClickDisabled) {
      return;
    }
    if (shouldCloseOnClick) {
      onClose(e);
    } else {
      togglePlayState(e);
    }
  });

  useVideoCleanup(videoRef, bufferingHandlers);

  const handleTimeUpdate = useLastCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (video.readyState >= MIN_READY_STATE) {
      setIsVideoWaiting(false);
      setCurrentTime(video.currentTime);
    }
    if (!isLooped && video.currentTime === video.duration) {
      setCurrentTime(0);
      setIsPlaying(false);
    }
  });

  const handleEnded = useLastCallback(() => {
    if (isLooped) return;
    setCurrentTime(0);
    setIsPlaying(false);
    toggleControls(true);
  });

  const handleFullscreenChange = useLastCallback(() => {
    if (isFullscreen && exitFullscreen) {
      exitFullscreen();
    } else if (!isFullscreen && setFullscreen) {
      setFullscreen();
    }
  });

  const handleSeek = useLastCallback((position: number) => {
    videoRef.current!.currentTime = position;
  });

  const handleVolumeChange = useLastCallback((newVolume: number) => {
    setMediaViewerVolume({ volume: newVolume / 100 });
  });

  const handleVolumeMuted = useLastCallback(() => {
    // Browser requires explicit user interaction to keep video playing after unmuting
    videoRef.current!.muted = !videoRef.current!.muted;
    setMediaViewerMuted({ isMuted: !isMuted });
  });

  const handlePlaybackRateChange = useLastCallback((newPlaybackRate: number) => {
    setMediaViewerPlaybackRate({ playbackRate: newPlaybackRate });
  });

  useEffect(() => {
    if (!isMediaViewerOpen) return undefined;
    const rewind = (dir: number) => {
      if (!isFullscreen) return;
      const video = videoRef.current!;
      const newTime = clamp(video.currentTime + dir * REWIND_STEP, 0, video.duration);
      if (Number.isFinite(newTime)) {
        video.currentTime = newTime;
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInPictureInPicture) return;
      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault();
          togglePlayState(e);
          break;
        case 'Left': // IE/Edge specific value
        case 'ArrowLeft':
          e.preventDefault();
          rewind(-1);
          break;
        case 'Right': // IE/Edge specific value
        case 'ArrowRight':
          e.preventDefault();
          rewind(1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown, false);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, false);
    };
  }, [togglePlayState, isMediaViewerOpen, isFullscreen, isInPictureInPicture]);

  const wrapperStyle = posterSize && `width: ${posterSize.width}px; height: ${posterSize.height}px`;
  const videoStyle = `background-image: url(${posterData})`;
  const shouldToggleControls = !IS_TOUCH_ENV && !isForceMobileVersion;

  return (
    <div
      className="VideoPlayer"
      onMouseMove={shouldToggleControls ? handleVideoMove : undefined}
      onMouseLeave={shouldToggleControls ? handleVideoLeave : undefined}
    >
      <div
        style={wrapperStyle}
      >
        {isProtected && (
          <div
            onContextMenu={stopEvent}
            onDoubleClick={!IS_TOUCH_ENV ? handleFullscreenChange : undefined}
            onClick={!isMobile ? togglePlayState : undefined}
            className="protector"
          />
        )}
        <video
          ref={videoRef}
          autoPlay={IS_TOUCH_ENV}
          controlsList="nodownload"
          playsInline
          loop={isLooped}
          // This is to force autoplaying on mobiles
          muted={isGif || isMuted}
          id="media-viewer-video"
          style={videoStyle}
          onWaiting={() => setIsVideoWaiting(true)}
          onPlay={() => setIsPlaying(true)}
          onEnded={handleEnded}
          onClick={!isMobile && !isFullscreen ? handleClick : undefined}
          onDoubleClick={!IS_TOUCH_ENV ? handleFullscreenChange : undefined}

          {...bufferingHandlers}
          onPause={(e) => {
            setIsPlaying(false);
            bufferingHandlers.onPause(e);
          }}
          onTimeUpdate={handleTimeUpdate}
          src={url}
        />
      </div>
      {shouldRenderPlayButton && (
        <Button round className={`play-button ${playButtonClassNames}`} onClick={togglePlayState} iconName="play" />
      )}
      {shouldRenderSpinner && (
        <div className={['spinner-container', spinnerClassNames].join(' ')}>
          {!isBuffered && <div className="buffering">Buffering...</div>}
          <ProgressSpinner
            size="xl"
            progress={isBuffered ? 1 : loadProgress}
            onClick={onClose}
          />
        </div>
      )}
      {!isGif && !isSponsoredMessage && !isUnsupported && (
        <VideoPlayerControls
          storyboardInfo={storyboardInfo}
          isPlaying={isPlaying}
          bufferedRanges={bufferedRanges}
          bufferedProgress={bufferedProgress}
          isBuffered={isBuffered}
          isFullscreenSupported={Boolean(setFullscreen)}
          isPictureInPictureSupported={isPictureInPictureSupported}
          isFullscreen={isFullscreen}
          fileSize={fileSize}
          duration={duration}
          isReady={isReady}
          isForceMobileVersion={isForceMobileVersion}
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
          onSeekingChange={handleSeekingChange}
        />
      )}
    </div>
  );
};

export default memo(VideoPlayer);
