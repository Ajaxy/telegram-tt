import type { ElementRef } from '../../../lib/teact/teact';
import { memo, useEffect, useRef } from '../../../lib/teact/teact';

import { MAX_ROUND_VIDEO_RECORDING_DURATION } from '../../../config';
import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import buildClassName from '../../../util/buildClassName';
import safePlay from '../../../util/safePlay';

import Skeleton from '../../ui/placeholder/Skeleton';
import Portal from '../../ui/Portal';

import styles from './RoundVideoRecorder.module.scss';

type OwnProps = {
  ref?: ElementRef<HTMLDivElement>;
  previewStream?: MediaStream;
  isReady?: boolean;
  isPaused?: boolean;
  isFrozen?: boolean;
  getProgress: () => number;
  getPlaybackEl?: () => HTMLVideoElement | undefined;
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

const RoundVideoRecorder = ({
  ref, previewStream, isReady, isPaused, isFrozen, getProgress, getPlaybackEl,
}: OwnProps) => {
  const videoRef = useRef<HTMLVideoElement>();
  const posterRef = useRef<HTMLCanvasElement>();
  const circleRef = useRef<SVGCircleElement>();
  const playbackLayerRef = useRef<HTMLDivElement>();
  const appendedPlaybackElRef = useRef<HTMLVideoElement>();
  const hasPosterRef = useRef(false);
  const lastDashOffsetRef = useRef<number>();

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !previewStream) return undefined;

    hasPosterRef.current = false;
    videoEl.srcObject = previewStream;
    videoEl.muted = true;
    videoEl.playsInline = true;
    safePlay(videoEl);

    return () => {
      videoEl.pause();
      // eslint-disable-next-line no-null/no-null
      videoEl.srcObject = null;
    };
  }, [previewStream]);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || isFrozen) return;

    if (isPaused) {
      videoEl.pause();
    } else {
      safePlay(videoEl);
    }
  }, [isPaused, isFrozen]);

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

      const playbackEl = getPlaybackEl?.();
      if (playbackEl !== appendedPlaybackElRef.current) {
        const previousEl = appendedPlaybackElRef.current;
        appendedPlaybackElRef.current = playbackEl;
        requestMutation(() => {
          previousEl?.remove();
          if (playbackEl && playbackLayerRef.current) {
            playbackEl.classList.add(styles.playbackVideo);
            playbackLayerRef.current.appendChild(playbackEl);
          }
        });
      }

      const circle = circleRef.current;
      if (circle) {
        const offset = CIRCUMFERENCE * (1 - progress);
        if (offset !== lastDashOffsetRef.current) {
          lastDashOffsetRef.current = offset;
          requestMutation(() => {
            circle.style.strokeDashoffset = String(offset);
          });
        }
      }

      rafId = requestAnimationFrame(updateProgress);
    };

    updateProgress();

    return () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      appendedPlaybackElRef.current?.remove();
      appendedPlaybackElRef.current = undefined;
    };
  }, [getProgress, getPlaybackEl]);

  return (
    <Portal>
      <div ref={ref} className={buildClassName(styles.root, !isReady && styles.preparing)}>
        <canvas
          ref={posterRef}
          className={buildClassName(styles.video, !isFrozen && styles.hidden)}
        />
        <video
          ref={videoRef}
          className={buildClassName(styles.video, isFrozen && styles.hidden)}
        />
        <div ref={playbackLayerRef} className={styles.playbackLayer} />
        <div className={buildClassName(styles.waitingMask, isReady && styles.waitingMaskHidden)}>
          <Skeleton variant="round" animation="wave" className={styles.waitingSkeleton} />
        </div>
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
