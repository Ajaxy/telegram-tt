import { useEffect, useRef, useSignal, useState } from '@teact';

import type { VideoTrim } from '../../../../types/mediaEditor';

import { VIDEO_TIME_PRECISION } from '../../../../config';
import isTextInputTarget from '../../../../util/events/isTextInputTarget';
import { clamp } from '../../../../util/math';

import useLastCallback from '../../../../hooks/useLastCallback';
import useWindow from '../../../../hooks/useWindow';

const SEEK_STEP = 1; // s
const END_EPSILON = 0.05; // s
const SPACE_CONTROL_SELECTOR = 'button, select, input[type="checkbox"], input[type="radio"]';
const ARROW_CONTROL_SELECTOR = 'select, input[type="range"], [role="slider"]';

type Options = {
  video?: HTMLVideoElement;
  duration: number;
  frameRate: number;
  trim?: VideoTrim;
  isActive: boolean;
  onToggleMute?: NoneToVoidFunction;
};

export default function useVideoPlayback({
  video,
  duration,
  frameRate,
  trim,
  isActive,
  onToggleMute,
}: Options) {
  const renderingWindow = useWindow();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPausedByUser, setIsPausedByUser] = useState(false);
  const [getCurrentTime, setCurrentTime] = useSignal(0);
  const pendingSeekTimeRef = useRef<number>();

  const start = trim?.start ?? 0;
  const end = trim?.end ?? duration;
  const shouldPlay = isActive && !isPausedByUser;

  const seek = useLastCallback((time: number) => {
    if (!video) return;
    const clampedTime = clamp(time, 0, duration);
    setCurrentTime(clampedTime);
    if (video.seeking) {
      pendingSeekTimeRef.current = clampedTime;
      return;
    }
    video.currentTime = clampedTime;
  });

  const play = useLastCallback(() => {
    if (!video) return;
    if (video.currentTime < start - VIDEO_TIME_PRECISION || video.currentTime >= end - END_EPSILON) {
      seek(start);
    }
    video.play().catch((err: Error) => {
      if (err.name === 'NotAllowedError') setIsPausedByUser(true);
    });
  });

  const toggle = useLastCallback(() => {
    if (isPausedByUser) {
      setIsPausedByUser(false);
      if (isActive) play();
    } else {
      setIsPausedByUser(true);
      video?.pause();
    }
  });

  const handleTimeUpdate = useLastCallback(() => {
    if (!video) return;
    if (!video.paused && video.currentTime >= end - END_EPSILON) {
      seek(start);
      return;
    }
    setCurrentTime(video.currentTime);
  });

  const handleEnded = useLastCallback(() => {
    if (shouldPlay) play();
  });

  useEffect(() => {
    setIsPlaying(false);
    setIsPausedByUser(false);
    pendingSeekTimeRef.current = undefined;
    setCurrentTime(video?.currentTime ?? 0);
    if (!video) return undefined;

    let frameHandle = 0;
    const updateTime = () => {
      handleTimeUpdate();
      frameHandle = requestAnimationFrame(updateTime);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      frameHandle = requestAnimationFrame(updateTime);
    };
    const handlePause = () => {
      setIsPlaying(false);
      cancelAnimationFrame(frameHandle);
      setCurrentTime(video.currentTime);
    };
    const handleSeeked = () => {
      const pendingTime = pendingSeekTimeRef.current;
      pendingSeekTimeRef.current = undefined;
      if (pendingTime === undefined) {
        setCurrentTime(video.currentTime);
      } else {
        video.currentTime = pendingTime;
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('ended', handleEnded);

    return () => {
      cancelAnimationFrame(frameHandle);
      video.pause();
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('ended', handleEnded);
    };
  }, [video, setCurrentTime, handleEnded]);

  useEffect(() => {
    if (shouldPlay) play();
    else video?.pause();
  }, [video, shouldPlay, play]);

  const handleKeyDown = useLastCallback((e: KeyboardEvent) => {
    if (isTextInputTarget(e.target)) return;

    if (e.key === ' ') {
      if (e.target instanceof Element && e.target.closest(SPACE_CONTROL_SELECTOR)) return;

      e.preventDefault();
      toggle();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (e.target instanceof Element && e.target.closest(ARROW_CONTROL_SELECTOR)) return;

      e.preventDefault();
      const step = e.shiftKey ? 1 / frameRate : SEEK_STEP;
      const direction = e.key === 'ArrowLeft' ? -1 : 1;
      seek(clamp(getCurrentTime() + step * direction, start, end));
    } else if (e.code === 'KeyM' && onToggleMute && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      onToggleMute();
    }
  });

  useEffect(() => {
    if (!isActive || !video) return undefined;

    renderingWindow.document.addEventListener('keydown', handleKeyDown);
    return () => renderingWindow.document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, video, handleKeyDown, renderingWindow]);

  return {
    isPlaying,
    isPausedByUser,
    getCurrentTime,
    toggle,
    seek,
  };
}
