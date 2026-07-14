import { memo, useEffect, useRef } from '../../../lib/teact/teact';

import { MAX_ROUND_VIDEO_RECORDING_DURATION } from '../../../config';
import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import buildClassName from '../../../util/buildClassName';

import Portal from '../../ui/Portal';

import styles from './RoundVideoRecorder.module.scss';

type OwnProps = {
  previewStream: MediaStream;
  getProgress: () => number;
  isFrozen?: boolean;
};

const SIZE = 240;
const STROKE_WIDTH = 2.5;
const PROGRESS_MARGIN = 2;
const CENTER = SIZE / 2;
const RADIUS = CENTER - STROKE_WIDTH - PROGRESS_MARGIN;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const POSTER_CAPTURE_LEAD_MS = 2000;
const POSTER_CAPTURE_PROGRESS = MAX_ROUND_VIDEO_RECORDING_DURATION > POSTER_CAPTURE_LEAD_MS
  ? (MAX_ROUND_VIDEO_RECORDING_DURATION - POSTER_CAPTURE_LEAD_MS) / MAX_ROUND_VIDEO_RECORDING_DURATION
  : 0.5;

const RoundVideoRecorder = ({ previewStream, getProgress, isFrozen }: OwnProps) => {
  const videoRef = useRef<HTMLVideoElement>();
  const posterRef = useRef<HTMLCanvasElement>();
  const circleRef = useRef<SVGCircleElement>();
  const hasPosterRef = useRef(false);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return undefined;

    hasPosterRef.current = false;
    videoEl.srcObject = previewStream;
    videoEl.muted = true;
    videoEl.playsInline = true;
    void videoEl.play();

    return () => {
      videoEl.pause();
      // eslint-disable-next-line no-null/no-null
      videoEl.srcObject = null;
    };
  }, [previewStream]);

  useEffect(() => {
    let rafId: number | undefined;

    const updateProgress = () => {
      const progress = getProgress();

      if (!hasPosterRef.current && progress >= POSTER_CAPTURE_PROGRESS) {
        const videoEl = videoRef.current;
        const posterEl = posterRef.current;
        if (videoEl && posterEl && videoEl.videoWidth) {
          const side = Math.min(videoEl.videoWidth, videoEl.videoHeight);
          const offsetX = (videoEl.videoWidth - side) / 2;
          const offsetY = (videoEl.videoHeight - side) / 2;
          posterEl.width = side;
          posterEl.height = side;
          posterEl.getContext('2d')?.drawImage(videoEl, offsetX, offsetY, side, side, 0, 0, side, side);
          hasPosterRef.current = true;
        }
      }

      const circle = circleRef.current;
      if (circle) {
        const offset = CIRCUMFERENCE * (1 - progress);
        requestMutation(() => {
          circle.style.strokeDashoffset = String(offset);
        });
      }

      rafId = requestAnimationFrame(updateProgress);
    };

    updateProgress();

    return () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId);
    };
  }, [getProgress]);

  return (
    <Portal>
      <div className={styles.root}>
        <canvas
          ref={posterRef}
          className={buildClassName(styles.video, !isFrozen && styles.hidden)}
        />
        <video
          ref={videoRef}
          className={buildClassName(styles.video, isFrozen && styles.hidden)}
        />
        <svg className={styles.progress} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle
            ref={circleRef}
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            className={styles.progressCircle}
            transform={`rotate(-90, ${CENTER}, ${CENTER})`}
            stroke-width={STROKE_WIDTH}
            stroke-dasharray={CIRCUMFERENCE}
            stroke-dashoffset={CIRCUMFERENCE}
          />
        </svg>
      </div>
    </Portal>
  );
};

export default memo(RoundVideoRecorder);
