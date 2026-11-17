import { memo, useEffect, useRef } from '../../../lib/teact/teact';

import type { Signal } from '../../../util/signals';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import {
  getOwnerCurrentTime, isCurrentElementPlaying, pause, previewProgress, resume,
} from '../../../util/audioPlayback/playbackController';
import buildClassName from '../../../util/buildClassName';
import { captureEvents } from '../../../util/captureEvents';
import { clamp } from '../../../util/math';

import useLastCallback from '../../../hooks/useLastCallback';
import useWindow from '../../../hooks/useWindow';

import styles from './PlayerSeekLine.module.scss';

type OwnProps = {
  duration: number;
  className?: string;
  withThumb?: boolean;
  isCentered?: boolean;
  getProgress: Signal<number>;
  onSeek: (time: number) => void;
};

const PlayerSeekLine = ({
  duration,
  className,
  withThumb,
  isCentered,
  getProgress,
  onSeek,
}: OwnProps) => {
  const targetWindow = useWindow();
  const containerRef = useRef<HTMLDivElement>();
  const fillRef = useRef<HTMLDivElement>();
  const thumbRef = useRef<HTMLDivElement>();
  const isSeekingRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const pendingProgressRef = useRef(0);

  const applyFillProgress = useLastCallback((progress: number) => {
    const fill = fillRef.current;
    if (!fill) return;
    const thumb = thumbRef.current;

    requestMutation(() => {
      fill.style.transform = `scaleX(${progress})`;
      if (thumb) thumb.style.left = `${progress * 100}%`;
    });
  });

  useEffect(() => {
    if (isSeekingRef.current) return;
    applyFillProgress(clamp(getProgress(), 0, 1));
  }, [getProgress, applyFillProgress]);

  const progressFromClientX = useLastCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return 0;

    const { left, width } = container.getBoundingClientRect();
    return clamp((clientX - left) / width, 0, 1);
  });

  const toggleSeekingClass = useLastCallback((isSeeking: boolean) => {
    const container = containerRef.current;
    if (!container) return;

    requestMutation(() => {
      container.classList.toggle(styles.seeking, isSeeking);
    });
  });

  const handleCapture = useLastCallback((e: MouseEvent | TouchEvent | WheelEvent) => {
    if ('button' in e && e.button !== 0) return;

    isSeekingRef.current = true;
    toggleSeekingClass(true);
    pendingProgressRef.current = progressFromClientX(getClientX(e));
    applyFillProgress(pendingProgressRef.current);
  });

  const handleDrag = useLastCallback((e: MouseEvent | TouchEvent | WheelEvent) => {
    if (!isSeekingRef.current) return;

    if (!wasPlayingRef.current && isCurrentElementPlaying()) {
      wasPlayingRef.current = true;
      pause();
    }
    pendingProgressRef.current = progressFromClientX(getClientX(e));
    applyFillProgress(pendingProgressRef.current);
    previewProgress(pendingProgressRef.current);
  });

  const handleCancelSeek = useLastCallback(() => {
    if (!isSeekingRef.current) return;

    isSeekingRef.current = false;
    toggleSeekingClass(false);
    if (duration) previewProgress(getOwnerCurrentTime() / duration);
    applyFillProgress(clamp(getProgress(), 0, 1));
    if (wasPlayingRef.current) {
      wasPlayingRef.current = false;
      resume();
    }
  });

  const handleRelease = useLastCallback(() => {
    if (!isSeekingRef.current) return;

    isSeekingRef.current = false;
    toggleSeekingClass(false);
    if (duration) onSeek(pendingProgressRef.current * duration);
    if (wasPlayingRef.current) {
      wasPlayingRef.current = false;
      resume();
    }
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const cleanupCaptureEvents = captureEvents(container, {
      onCapture: handleCapture,
      onDrag: handleDrag,
      onRelease: handleRelease,
      onClick: handleRelease,
    });

    const handleTouchEnd = () => handleRelease();
    const handleTouchCancel = () => handleCancelSeek();
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      handleCancelSeek();
      cleanupCaptureEvents();
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [handleCapture, handleDrag, handleRelease, handleCancelSeek, targetWindow]);

  return (
    <div className={buildClassName(styles.root, isCentered && styles.centered, className)}>
      <div className={styles.line} ref={containerRef}>
        <div className={styles.clip}>
          <div className={styles.track} />
          <div className={styles.fill} ref={fillRef} />
        </div>
        {withThumb && <div className={styles.thumb} ref={thumbRef} />}
      </div>
    </div>
  );
};

function getClientX(e: MouseEvent | TouchEvent | WheelEvent) {
  return 'touches' in e ? e.touches[0].clientX : (e).clientX;
}

export default memo(PlayerSeekLine);
