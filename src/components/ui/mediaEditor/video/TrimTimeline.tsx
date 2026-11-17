import { memo, useLayoutEffect, useRef, useState } from '@teact';

import type { VideoTrim } from '../../../../types/mediaEditor';
import type { Signal } from '../../../../util/signals';
import type { Size } from '../render/transform';

import { MIN_VIDEO_TRIM_DURATION } from '../../../../config';
import buildClassName from '../../../../util/buildClassName';
import { formatMediaDuration } from '../../../../util/dates/duration';
import getPointerPosition from '../../../../util/events/getPointerPosition';
import { clamp } from '../../../../util/math';
import { clampCoverTime } from '../editDocument';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useWindow from '../../../../hooks/useWindow';

import ShowTransition from '../../ShowTransition';

import styles from '../MediaEditor.module.scss';

type OwnProps = {
  duration: number;
  trim?: VideoTrim;
  frames: (ImageBitmap | undefined)[];
  frameSize: Size;
  getCurrentTime: Signal<number>;
  canTrim: boolean;
  maxTrimDuration?: number;
  coverTime?: number;
  coverThumbUrl?: string;
  frameDuration: number;
  onSeek: (time: number) => void;
  onScrubStart: NoneToVoidFunction;
  onScrubEnd: NoneToVoidFunction;
  onTrimPreview: (trim: VideoTrim) => void;
  onTrimCommit: (trim: VideoTrim) => void;
  onCoverChange: (time: number) => void;
};

type DragTarget = 'start' | 'end' | 'segment' | 'scrub' | 'cover';

const MOVE_THRESHOLD = 2; // px
const SEEK_STEP = 1; // s
const PRECISE_LENGTH_THRESHOLD = 10; // s
const LENGTH_STEP = 0.25; // s

function TrimTimeline({
  duration,
  trim,
  frames,
  frameSize,
  getCurrentTime,
  canTrim,
  maxTrimDuration,
  coverTime,
  coverThumbUrl,
  frameDuration,
  onSeek,
  onScrubStart,
  onScrubEnd,
  onTrimPreview,
  onTrimCommit,
  onCoverChange,
}: OwnProps) {
  const lang = useLang();
  const renderingWindow = useWindow();
  const rootRef = useRef<HTMLDivElement>();
  const playheadRef = useRef<HTMLDivElement>();
  const [draggedTrim, setDraggedTrim] = useState<VideoTrim | undefined>();
  const [draggedCoverTime, setDraggedCoverTime] = useState<number | undefined>();
  const [shownCoverThumbUrl, setShownCoverThumbUrl] = useState<string | undefined>();
  const isCoverMode = coverTime !== undefined;

  const start = trim?.start ?? 0;
  const end = trim?.end ?? duration;

  useLayoutEffect(() => {
    setShownCoverThumbUrl(undefined);
  }, [coverTime]);

  useLayoutEffect(() => {
    setShownCoverThumbUrl(coverThumbUrl);
  }, [coverThumbUrl]);

  function getMinTrimStart(trimEnd: number) {
    return maxTrimDuration ? Math.max(0, trimEnd - maxTrimDuration) : 0;
  }

  function getMaxTrimEnd(trimStart: number) {
    return maxTrimDuration ? Math.min(duration, trimStart + maxTrimDuration) : duration;
  }

  useLayoutEffect(() => {
    if (!playheadRef.current) return;
    playheadRef.current.style.left = `${(getCurrentTime() / duration) * 100}%`;
  }, [getCurrentTime, duration]);

  const handlePointerDown = useLastCallback((e: React.MouseEvent | React.TouchEvent, target: DragTarget) => {
    const root = rootRef.current;
    if (!root) return;

    e.preventDefault();
    e.stopPropagation();

    const rect = root.getBoundingClientRect();
    const startX = getPointerPosition(e).x;
    const getTimeAt = (x: number) => clamp((x - rect.left) / rect.width, 0, 1) * duration;
    const initialTrim = { start, end };
    const initialTime = getCurrentTime();
    const length = end - start;
    let lastTrim = initialTrim;
    let lastCoverTime = coverTime;
    let hasMoved = false;

    onScrubStart();
    const targetDocument = renderingWindow.document;

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      const { x } = getPointerPosition(ev);
      if (!hasMoved && Math.abs(x - startX) < MOVE_THRESHOLD) return;
      hasMoved = true;

      const time = getTimeAt(x);
      if (target === 'start') {
        lastTrim = {
          start: clamp(time, getMinTrimStart(initialTrim.end), initialTrim.end - MIN_VIDEO_TRIM_DURATION),
          end: initialTrim.end,
        };
        onSeek(lastTrim.start);
      } else if (target === 'end') {
        lastTrim = {
          start: initialTrim.start,
          end: clamp(time, initialTrim.start + MIN_VIDEO_TRIM_DURATION, getMaxTrimEnd(initialTrim.start)),
        };
        onSeek(lastTrim.end);
      } else if (target === 'segment') {
        const newStart = clamp(initialTrim.start + ((x - startX) / rect.width) * duration, 0, duration - length);
        lastTrim = { start: newStart, end: newStart + length };
        onSeek(lastTrim.start);
      } else if (target === 'cover') {
        lastCoverTime = clampCoverTime(time, start, end, frameDuration);
        onSeek(lastCoverTime);
        setDraggedCoverTime(lastCoverTime);
        return;
      } else {
        onSeek(clamp(time, start, end));
        return;
      }

      onTrimPreview(lastTrim);
      setDraggedTrim(lastTrim);
    };

    const handleUp = () => {
      targetDocument.removeEventListener('mousemove', handleMove);
      targetDocument.removeEventListener('touchmove', handleMove);
      targetDocument.removeEventListener('mouseup', handleUp);
      targetDocument.removeEventListener('touchend', handleUp);
      targetDocument.removeEventListener('touchcancel', handleUp);
      setDraggedTrim(undefined);
      setDraggedCoverTime(undefined);

      if (!hasMoved) {
        if (target !== 'start' && target !== 'end') {
          const time = clamp(getTimeAt(startX), start, end);
          if (isCoverMode) {
            const coverTimeAt = clampCoverTime(time, start, end, frameDuration);
            onSeek(coverTimeAt);
            onCoverChange(coverTimeAt);
          } else {
            onSeek(time);
          }
        }
      } else if (target === 'cover') {
        onCoverChange(lastCoverTime!);
      } else if (target !== 'scrub') {
        onTrimCommit(lastTrim);
        onSeek(clamp(initialTime, lastTrim.start, lastTrim.end));
      }

      onScrubEnd();
    };

    targetDocument.addEventListener('mousemove', handleMove);
    targetDocument.addEventListener('touchmove', handleMove);
    targetDocument.addEventListener('mouseup', handleUp);
    targetDocument.addEventListener('touchend', handleUp);
    targetDocument.addEventListener('touchcancel', handleUp);
  });

  const handleStripPointerDown = useLastCallback((e: React.MouseEvent | React.TouchEvent) => {
    const root = rootRef.current;
    if (!root) return;

    const rect = root.getBoundingClientRect();
    const time = clamp((getPointerPosition(e).x - rect.left) / rect.width, 0, 1) * duration;
    const isInTrim = trim && time >= start && time <= end;
    handlePointerDown(e, isInTrim ? 'segment' : isCoverMode ? 'cover' : 'scrub');
  });

  const handleHandleKeyDown = useLastCallback((e: React.KeyboardEvent, target: 'start' | 'end') => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

    e.preventDefault();
    e.stopPropagation();

    const delta = (e.shiftKey ? frameDuration : SEEK_STEP) * (e.key === 'ArrowLeft' ? -1 : 1);
    const newTrim = target === 'start'
      ? { start: clamp(start + delta, getMinTrimStart(end), end - MIN_VIDEO_TRIM_DURATION), end }
      : { start, end: clamp(end + delta, start + MIN_VIDEO_TRIM_DURATION, getMaxTrimEnd(start)) };

    onTrimCommit(newTrim);
    onSeek(target === 'start' ? newTrim.start : newTrim.end);
  });

  const renderHandle = (target: 'start' | 'end') => {
    const value = target === 'start' ? start : end;

    return (
      <div
        className={buildClassName(
          styles.trimHandle,
          target === 'start' ? styles.trimHandleStart : styles.trimHandleEnd,
        )}
        role="slider"
        tabIndex={0}
        aria-label={lang(target === 'start' ? 'EditorTrimStart' : 'EditorTrimEnd')}
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={value}
        aria-valuetext={formatMediaDuration(value)}
        onMouseDown={(e) => handlePointerDown(e, target)}
        onTouchStart={(e) => handlePointerDown(e, target)}
        onKeyDown={(e) => handleHandleKeyDown(e, target)}
      />
    );
  };

  const startPercent = (start / duration) * 100;
  const endPercent = (end / duration) * 100;

  return (
    <div
      ref={rootRef}
      className={styles.trimTimeline}
      dir="ltr"
      onMouseDown={handleStripPointerDown}
      onTouchStart={handleStripPointerDown}
    >
      <div className={styles.timelineFrames}>
        {frames.map((frame, index) => (
          <TimelineFrame key={index} frame={frame} frameSize={frameSize} />
        ))}
      </div>
      <div className={styles.trimShade} style={`left: 0; width: ${startPercent}%`} />
      <div className={styles.trimShade} style={`left: ${endPercent}%; right: 0`} />
      <div
        className={buildClassName(styles.trimFrame, trim && styles.trimmed)}
        style={`left: ${startPercent}%; width: ${endPercent - startPercent}%`}
      >
        {canTrim && renderHandle('start')}
        {canTrim && renderHandle('end')}
      </div>
      {isCoverMode ? (
        <div
          className={styles.coverMarker}
          style={`left: ${((draggedCoverTime ?? coverTime) / duration) * 100}%`}
          onMouseDown={(e) => handlePointerDown(e, 'cover')}
          onTouchStart={(e) => handlePointerDown(e, 'cover')}
        >
          <ShowTransition
            isOpen={Boolean(shownCoverThumbUrl) && draggedCoverTime === undefined}
            className={styles.coverMarkerThumb}
          >
            <img className={styles.coverMarkerImage} src={shownCoverThumbUrl} alt="" draggable={false} />
          </ShowTransition>
        </div>
      ) : (
        <div ref={playheadRef} className={styles.playhead} />
      )}
      {draggedTrim && (
        <div className={styles.trimLength}>{formatTrimLength(draggedTrim.end - draggedTrim.start)}</div>
      )}
    </div>
  );
}

const TimelineFrame = memo(({ frame, frameSize }: { frame?: ImageBitmap; frameSize: Size }) => {
  const canvasRef = useRef<HTMLCanvasElement>();

  useLayoutEffect(() => {
    if (!frame || !canvasRef.current) return;
    canvasRef.current.getContext('2d')!.drawImage(frame, 0, 0, frameSize.width, frameSize.height);
  }, [frame, frameSize]);

  return (
    <canvas
      ref={canvasRef}
      className={buildClassName(styles.timelineFrame, frame && styles.loaded)}
      width={frameSize.width}
      height={frameSize.height}
    />
  );
});

function formatTrimLength(length: number) {
  if (length >= PRECISE_LENGTH_THRESHOLD) return formatMediaDuration(length);

  const rounded = Math.round(length / LENGTH_STEP) * LENGTH_STEP;
  const fraction = rounded - Math.floor(rounded);
  const formatted = formatMediaDuration(Math.floor(rounded));
  return fraction ? `${formatted}${String(fraction).slice(1)}` : formatted;
}

export default memo(TrimTimeline);
