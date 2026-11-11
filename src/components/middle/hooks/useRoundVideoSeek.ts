import type { ElementRef } from '../../../lib/teact/teact';
import { useEffect, useRef } from '../../../lib/teact/teact';

import type { TrackKey } from '../../../util/audioPlayback/mediaPool';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { peek } from '../../../util/audioPlayback/mediaPool';
import { clamp } from '../../../util/math';
import stopEvent from '../../../util/stopEvent';

import useLastCallback from '../../../hooks/useLastCallback';

const FULL_TURN = Math.PI * 2;
const QUARTER_TURN = Math.PI / 2;
const PROGRESS_MIDPOINT = 0.5;
const SEEK_STEP = 5;
const SEEK_END_OFFSET = 0.01;
const SEEK_WRAP_THRESHOLD = 0.9;

type SeekPoint = {
  x: number;
  y: number;
};

type SeekState = {
  pointerId: number;
  point: SeekPoint;
  turns: number;
  progress: number;
  frameTime?: number;
};

export default function useRoundVideoSeek({
  ref, trackKey, canSeek, getProgress, previewProgress,
}: {
  ref: ElementRef<HTMLDivElement>;
  trackKey?: TrackKey;
  canSeek: boolean;
  getProgress: () => number;
  previewProgress: (progress: number) => void;
}) {
  const seekStateRef = useRef<SeekState>();

  const getPlayer = useLastCallback(() => (trackKey ? peek(trackKey) : undefined));

  // Seeking only after the previous frame is shown keeps frames updating while the pointer moves
  const seekFrame = useLastCallback(() => {
    requestMutation(() => {
      const seekState = seekStateRef.current;
      const playerEl = getPlayer();
      if (!seekState || !playerEl || playerEl.seeking) return;

      const time = getSeekTime(playerEl, seekState.progress);
      if (time === seekState.frameTime) return;

      seekState.frameTime = time;
      playerEl.currentTime = time;
    });
  });

  const handleSeekFrame = useLastCallback(() => {
    const seekState = seekStateRef.current;
    if (!seekState) return;

    // Seek events report the shown frame, which lags behind the pointer
    previewProgress(seekState.progress);
    seekFrame();
  });

  useEffect(() => {
    if (!canSeek) return undefined;

    const element = ref.current!;
    const playerEl = getPlayer();
    // Native listeners keep seeking away from message selection, swipe-to-reply and long press
    element.addEventListener('touchstart', stopEvent, { passive: false });
    element.addEventListener('mousedown', stopEvent);
    element.addEventListener('dblclick', stopEvent);
    playerEl?.addEventListener('seeking', handleSeekFrame);
    playerEl?.addEventListener('seeked', handleSeekFrame);

    return () => {
      seekStateRef.current = undefined;
      element.removeEventListener('touchstart', stopEvent);
      element.removeEventListener('mousedown', stopEvent);
      element.removeEventListener('dblclick', stopEvent);
      playerEl?.removeEventListener('seeking', handleSeekFrame);
      playerEl?.removeEventListener('seeked', handleSeekFrame);
    };
  }, [canSeek, ref, trackKey, getPlayer, handleSeekFrame]);

  const handleSeekStart = useLastCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const playerEl = getPlayer();
    if (!canSeek || e.button !== 0 || !e.isPrimary || seekStateRef.current || !hasDuration(playerEl)) return;

    stopEvent(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = getSeekPoint(e);
    const angle = getSeekAngle(point);
    const currentProgress = getProgress();
    // The top of the ring represents both ends; grab the one nearest the current position
    const turns = Math.abs(angle - currentProgress) > SEEK_WRAP_THRESHOLD ? Math.sign(currentProgress - angle) : 0;
    const progress = clamp(angle + turns, 0, 1);
    seekStateRef.current = {
      pointerId: e.pointerId, point, turns, progress,
    };
    previewProgress(progress);
    seekFrame();
  });

  const handleSeekMove = useLastCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const seekState = seekStateRef.current;
    if (!seekState || seekState.pointerId !== e.pointerId) return;

    stopEvent(e);
    const point = getSeekPoint(e);
    // Crossing the top past an end pins the progress there until the pointer crosses back
    if (isCrossingTop(seekState.point, point)) {
      seekState.turns = clamp(seekState.turns + (point.x < 0 ? -1 : 1), -1, 1);
    }
    seekState.point = point;
    seekState.progress = clamp(getSeekAngle(point) + seekState.turns, 0, 1);
    previewProgress(seekState.progress);
    seekFrame();
  });

  const handleSeekEnd = useLastCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const seekState = seekStateRef.current;
    if (!seekState || seekState.pointerId !== e.pointerId) return;

    handleSeekMove(e);
    seekStateRef.current = undefined;
    const playerEl = getPlayer();
    if (!hasDuration(playerEl)) return;

    const time = getSeekTime(playerEl, seekState.progress);
    requestMutation(() => {
      if (getPlayer() !== playerEl) return;

      playerEl.currentTime = time;
    });
  });

  const handleSeekCancel = useLastCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (seekStateRef.current?.pointerId !== e.pointerId) return;

    seekStateRef.current = undefined;
    const playerEl = getPlayer();
    if (hasDuration(playerEl)) previewProgress(playerEl.currentTime / playerEl.duration);
  });

  const handleSeekKeyDown = useLastCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const playerEl = getPlayer();
    if (!canSeek || seekStateRef.current || !hasDuration(playerEl)) return;

    let time: number;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        time = playerEl.currentTime - SEEK_STEP;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        time = playerEl.currentTime + SEEK_STEP;
        break;
      case 'Home':
        time = 0;
        break;
      case 'End':
        time = playerEl.duration;
        break;
      default:
        return;
    }
    stopEvent(e);
    time = clamp(time, 0, Math.max(0, playerEl.duration - SEEK_END_OFFSET));
    previewProgress(time / playerEl.duration);
    requestMutation(() => {
      if (getPlayer() !== playerEl) return;

      playerEl.currentTime = time;
    });
  });

  return {
    handleSeekStart, handleSeekMove, handleSeekEnd, handleSeekCancel, handleSeekKeyDown,
  };
}

export function getRingPoint(progress: number, center: number, radius: number) {
  const angle = progress * FULL_TURN - QUARTER_TURN;
  return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius };
}

function hasDuration(playerEl?: HTMLMediaElement): playerEl is HTMLMediaElement {
  return Boolean(playerEl && Number.isFinite(playerEl.duration) && playerEl.duration > 0);
}

function getSeekPoint(e: React.PointerEvent<HTMLDivElement>): SeekPoint {
  const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
  return {
    x: (e.clientX - left) / width - PROGRESS_MIDPOINT,
    y: (e.clientY - top) / height - PROGRESS_MIDPOINT,
  };
}

function getSeekAngle({ x, y }: SeekPoint) {
  const angle = Math.atan2(x, -y) / FULL_TURN;
  return angle < 0 ? angle + 1 : angle;
}

function getSeekTime(playerEl: HTMLMediaElement, progress: number) {
  return Math.min(progress * playerEl.duration, Math.max(0, playerEl.duration - SEEK_END_OFFSET));
}

function isCrossingTop(from: SeekPoint, to: SeekPoint) {
  if ((from.x < 0) === (to.x < 0)) return false;

  // The segment between pointer events meets the vertical axis above the center
  return from.y - (from.x * (to.y - from.y)) / (to.x - from.x) < 0;
}
