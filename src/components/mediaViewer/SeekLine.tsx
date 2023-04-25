import React, {
  useRef, useState, useCallback, useEffect, memo, useMemo, useLayoutEffect,
} from '../../lib/teact/teact';

import type { BufferedRange } from '../../hooks/useBuffering';
import type { ApiDimensions } from '../../api/types';

import useSignal from '../../hooks/useSignal';
import useCurrentTimeSignal from './hooks/currentTimeSignal';

import { captureEvents } from '../../util/captureEvents';
import { IS_TOUCH_ENV } from '../../util/windowEnvironment';
import buildClassName from '../../util/buildClassName';
import { formatMediaDuration } from '../../util/dateFormat';
import { clamp, round } from '../../util/math';

import { createVideoPreviews, renderVideoPreview, getPreviewDimensions } from '../../lib/video-preview/VideoPreview';

import ShowTransition from '../ui/ShowTransition';

import styles from './SeekLine.module.scss';

type OwnProps = {
  url?: string;
  duration: number;
  bufferedRanges: BufferedRange[];
  isActive?: boolean;
  isPreviewDisabled?: boolean;
  isReady: boolean;
  posterSize?: ApiDimensions;
  onSeek: (position: number) => void;
  onSeekStart: () => void;
};

const SeekLine: React.FC<OwnProps> = ({
  duration,
  bufferedRanges,
  isReady,
  posterSize,
  url,
  isActive,
  isPreviewDisabled,
  onSeek,
  onSeekStart,
}) => {
  // eslint-disable-next-line no-null/no-null
  const seekerRef = useRef<HTMLDivElement>(null);
  const [getCurrentTime] = useCurrentTimeSignal();
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

  const setPreview = useCallback((time: number) => {
    time = Math.floor(time);
    setPreviewTime(time);
    renderVideoPreview(time);
  }, [setPreviewTime]);

  useEffect(() => {
    if (isPreviewDisabled || !url || !isReady) return undefined;
    return createVideoPreviews(url, previewCanvasRef.current!);
  }, [url, isReady, isPreviewDisabled]);

  useEffect(() => {
    setPreviewVisible(false);
  }, [isActive]);

  useEffect(() => {
    if (!isLockedRef.current && !isSeeking) {
      setSelectedTime(getCurrentTime());
    }
  }, [getCurrentTime, isSeeking, setSelectedTime]);

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

    const handleSeek = (e: MouseEvent | TouchEvent) => {
      setPreviewVisible(true);
      ([time, offset] = getPreviewProps(e));
      void setPreview(time);
      setPreviewOffset(offset);
      setSelectedTime(time);
    };

    const handleStartSeek = () => {
      setPreviewVisible(true);
      setIsSeeking(true);
      onSeekStart();
    };

    const handleStopSeek = () => {
      isLockedRef.current = true;
      setPreviewVisible(false);
      setIsSeeking(false);
      setSelectedTime(time);
      onSeek(time);
      // Prevent current time updates from overriding the selected time
      setTimeout(() => {
        isLockedRef.current = false;
      }, 500);
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
