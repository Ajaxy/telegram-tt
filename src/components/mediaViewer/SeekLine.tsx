import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useLayoutEffect,
  useMemo, useRef, useSignal, useState,
} from '../../lib/teact/teact';

import type { ApiDimensions } from '../../api/types';
import type { BufferedRange } from '../../hooks/useBuffering';

import { createVideoPreviews, getPreviewDimensions, renderVideoPreview } from '../../lib/video-preview/VideoPreview';
import { animateNumber } from '../../util/animation';
import buildClassName from '../../util/buildClassName';
import { captureEvents } from '../../util/captureEvents';
import { formatMediaDuration } from '../../util/dates/dateFormat';
import { clamp, round } from '../../util/math';
import { IS_TOUCH_ENV } from '../../util/windowEnvironment';

import { useThrottledSignal } from '../../hooks/useAsyncResolvers';
import useCurrentTimeSignal from '../../hooks/useCurrentTimeSignal';
import useLastCallback from '../../hooks/useLastCallback';
import useVideoWaitingSignal from './hooks/useVideoWaitingSignal';

import ShowTransition from '../ui/ShowTransition';

import styles from './SeekLine.module.scss';

type OwnProps = {
  url?: string;
  duration: number;
  bufferedRanges: BufferedRange[];
  playbackRate: number;
  isActive?: boolean;
  isPlaying?: boolean;
  isPreviewDisabled?: boolean;
  isReady: boolean;
  posterSize?: ApiDimensions;
  onSeek: (position: number) => void;
  onSeekStart: () => void;
};

const LOCK_TIMEOUT = 250;
let cancelAnimation: Function | undefined;

const SeekLine: FC<OwnProps> = ({
  duration,
  bufferedRanges,
  isReady,
  posterSize,
  playbackRate,
  url,
  isActive,
  isPlaying,
  isPreviewDisabled,
  onSeek,
  onSeekStart,
}) => {
  // eslint-disable-next-line no-null/no-null
  const seekerRef = useRef<HTMLDivElement>(null);
  const [getCurrentTimeSignal] = useCurrentTimeSignal();
  const [getIsWaiting] = useVideoWaitingSignal();
  const getCurrentTime = useThrottledSignal(getCurrentTimeSignal, LOCK_TIMEOUT);
  const [getSelectedTime, setSelectedTime] = useSignal(getCurrentTime());
  const [getPreviewOffset, setPreviewOffset] = useSignal(0);
  const [getPreviewTime, setPreviewTime] = useSignal(0);
  const isLockedRef = useRef<boolean>(false);
  const [isPreviewVisible, setPreviewVisible] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  // eslint-disable-next-line no-null/no-null
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line no-null/no-null
  const previewRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const progressRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const previewTimeRef = useRef<HTMLDivElement>(null);

  const previewSize = useMemo(() => {
    return getPreviewDimensions(posterSize?.width || 0, posterSize?.height || 0);
  }, [posterSize]);

  const setPreview = useLastCallback((time: number) => {
    time = Math.floor(time);
    setPreviewTime(time);
    renderVideoPreview(time);
  });

  useEffect(() => {
    if (isPreviewDisabled || !url || !isReady) return undefined;
    return createVideoPreviews(url, previewCanvasRef.current!);
  }, [url, isReady, isPreviewDisabled]);

  useEffect(() => {
    setPreviewVisible(false);
  }, [isActive]);

  useEffect(() => {
    if (cancelAnimation) cancelAnimation();
    cancelAnimation = undefined;
    if (!isLockedRef.current && !isSeeking) {
      const time = getCurrentTime();
      const remaining = duration - time;
      cancelAnimation = animateNumber({
        from: time,
        to: duration,
        duration: (remaining * 1000) / playbackRate,
        onUpdate: setSelectedTime,
      });
    }
  }, [getCurrentTime, isSeeking, setSelectedTime, playbackRate, duration]);

  useEffect(() => {
    if (!isPlaying || getIsWaiting()) {
      if (cancelAnimation) cancelAnimation();
      cancelAnimation = undefined;
    }
  }, [isPlaying, getSelectedTime, getIsWaiting]);

  useEffect(() => {
    if (isPlaying) {
      if (cancelAnimation) cancelAnimation();
      cancelAnimation = undefined;
      const time = getCurrentTime();
      const remaining = duration - time;
      cancelAnimation = animateNumber({
        from: time,
        to: duration,
        duration: (remaining * 1000) / playbackRate,
        onUpdate: setSelectedTime,
      });
    }
    // eslint-disable-next-line
  }, [isPlaying, playbackRate, duration]);

  useLayoutEffect(() => {
    if (!progressRef.current) return;
    const progress = round((getSelectedTime() / duration) * 100, 2);
    progressRef.current.style.width = `${progress}%`;
  }, [getSelectedTime, duration]);

  useLayoutEffect(() => {
    if (!previewRef.current) return;
    previewRef.current.style.left = `${getPreviewOffset()}px`;
  }, [getPreviewOffset]);

  useLayoutEffect(() => {
    if (!previewTimeRef.current) return;
    previewTimeRef.current.innerText = formatMediaDuration(getPreviewTime());
  }, [getPreviewTime]);

  useEffect(() => {
    if (!seekerRef.current || !isActive) return undefined;
    const seeker = seekerRef.current;
    let seekerSize = seeker.getBoundingClientRect();

    let time = 0;
    let offset = 0;

    const getPreviewProps = (e: MouseEvent | TouchEvent) => {
      const pageX = e instanceof MouseEvent ? e.pageX : e.touches[0].pageX;
      const t = clamp(duration * ((pageX - seekerSize.left) / seekerSize.width), 0, duration);
      if (isPreviewDisabled) return [t, 0];
      if (!seekerSize.width) seekerSize = seeker.getBoundingClientRect();
      const preview = previewRef.current!;
      const o = clamp(
        pageX - seekerSize.left - preview.clientWidth / 2, -4, seekerSize.width - preview.clientWidth + 4,
      );
      return [t, o];
    };

    const stopAnimation = () => {
      if (cancelAnimation) cancelAnimation();
      cancelAnimation = undefined;
    };

    const handleSeek = (e: MouseEvent | TouchEvent) => {
      stopAnimation();
      setPreviewVisible(true);
      ([time, offset] = getPreviewProps(e));
      void setPreview(time);
      setPreviewOffset(offset);
      setSelectedTime(time);
    };

    const handleStartSeek = () => {
      stopAnimation();
      setPreviewVisible(true);
      setIsSeeking(true);
      onSeekStart();
    };

    const handleStopSeek = () => {
      stopAnimation();
      isLockedRef.current = true;
      setPreviewVisible(false);
      setIsSeeking(false);
      setSelectedTime(time);
      onSeek(time);
      // Prevent current time updates from overriding the selected time
      setTimeout(() => {
        isLockedRef.current = false;
      }, LOCK_TIMEOUT);
    };

    const cleanup = captureEvents(seeker, {
      onCapture: handleStartSeek,
      onRelease: handleStopSeek,
      onClick: handleStopSeek,
      onDrag: handleSeek,
    });

    if (IS_TOUCH_ENV || isPreviewDisabled) {
      return cleanup;
    }

    const handleSeekMouseMove = (e: MouseEvent) => {
      setPreviewVisible(true);
      ([time, offset] = getPreviewProps(e));
      setPreviewOffset(offset);
      void setPreview(time);
    };

    const handleSeekMouseLeave = () => {
      setPreviewVisible(false);
    };

    seeker.addEventListener('mousemove', handleSeekMouseMove);
    seeker.addEventListener('mouseenter', handleSeekMouseMove);
    seeker.addEventListener('mouseleave', handleSeekMouseLeave);

    return () => {
      cleanup();
      seeker.removeEventListener('mousemove', handleSeekMouseMove);
      seeker.removeEventListener('mouseenter', handleSeekMouseMove);
      seeker.removeEventListener('mouseleave', handleSeekMouseLeave);
    };
  }, [
    duration,
    setPreview,
    isActive,
    onSeek,
    onSeekStart,
    setPreviewOffset,
    setSelectedTime,
    setIsSeeking,
    isPreviewDisabled,
    playbackRate,
  ]);

  return (
    <div className={styles.container} ref={seekerRef}>
      {!isPreviewDisabled && (
        <ShowTransition
          isOpen
          isHidden={!isPreviewVisible}
          className={styles.preview}
          style={`width: ${previewSize.width}px; height: ${previewSize.height}px`}
          ref={previewRef}
        >
          <canvas className={styles.previewCanvas} ref={previewCanvasRef} />
          <div className={styles.previewTime}>
            <span className={styles.previewTimeText} ref={previewTimeRef} />
          </div>
        </ShowTransition>
      )}
      <div className={styles.track}>
        {bufferedRanges.map(({
          start,
          end,
        }) => (
          <div
            key={`${start}-${end}`}
            className={styles.buffered}
            // @ts-ignore
            style={`left: ${start * 100}%; right: ${100 - end * 100}%`}
          />
        ))}
      </div>
      <div className={styles.track}>
        <div
          ref={progressRef}
          className={buildClassName(styles.played, isSeeking && styles.seeking)}
        />
      </div>
    </div>
  );
};

export default memo(SeekLine);
