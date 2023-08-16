import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect, useRef } from '../../lib/teact/teact';

import { DPR } from '../../util/windowEnvironment';
import buildClassName from '../../util/buildClassName';

import './ProgressSpinner.scss';
import { animate, timingFunctions } from '../../util/animation';
import { requestMutation } from '../../lib/fasterdom/fasterdom';
import { useStateRef } from '../../hooks/useStateRef';

const SIZES = {
  s: 42, m: 48, l: 54, xl: 52,
};
const STROKE_WIDTH = 2 * DPR;
const STROKE_WIDTH_XL = 3 * DPR;
const PADDING = 2 * DPR;
const MIN_PROGRESS = 0.05;
const MAX_PROGRESS = 1;
const GROW_DURATION = 600; // 0.6 s
const ROTATE_DURATION = 2000; // 2 s

const ProgressSpinner: FC<{
  progress?: number;
  size?: 's' | 'm' | 'l' | 'xl';
  square?: boolean;
  transparent?: boolean;
  noCross?: boolean;
  onClick?: (e: React.MouseEvent<HTMLElement, MouseEvent>) => void;
}> = ({
  progress = 0,
  size = 'l',
  square,
  transparent,
  noCross,
  onClick,
}) => {
  // eslint-disable-next-line no-null/no-null
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const width = SIZES[size];
  const progressRef = useStateRef(progress);

  useEffect(() => {
    let isFirst = true;
    let growFrom = MIN_PROGRESS;
    let growStartedAt: number | undefined;
    let prevProgress: number | undefined;

    animate(() => {
      if (!canvasRef.current) {
        return false;
      }

      if (progressRef.current !== prevProgress) {
        growFrom = Math.min(Math.max(MIN_PROGRESS, prevProgress || 0), MAX_PROGRESS);
        growStartedAt = Date.now();
        prevProgress = progressRef.current;
      }

      const targetProgress = Math.min(Math.max(MIN_PROGRESS, progressRef.current), MAX_PROGRESS);
      const t = Math.min(1, (Date.now() - growStartedAt!) / GROW_DURATION);
      const animationFactor = timingFunctions.easeOutQuad(t);
      const currentProgress = growFrom + (targetProgress - growFrom) * animationFactor;

      drawSpinnerArc(
        canvasRef.current,
        width * DPR,
        size === 'xl' ? STROKE_WIDTH_XL : STROKE_WIDTH,
        'white',
        currentProgress,
        isFirst,
      );

      isFirst = false;

      return currentProgress < 1;
    }, requestMutation);
  }, [progressRef, size, width]);

  const className = buildClassName(
    `ProgressSpinner size-${size}`,
    transparent && 'transparent',
    square && 'square',
    noCross && 'no-cross',
  );

  return (
    <div
      className={className}
      onClick={onClick}
    >
      <canvas ref={canvasRef} className="ProgressSpinner_canvas" style={`width: ${width}; height: ${width}px;`} />
    </div>
  );
};

function drawSpinnerArc(
  canvas: HTMLCanvasElement,
  size: number,
  strokeWidth: number,
  color: string,
  progress: number,
  shouldInit = false,
) {
  const centerCoordinate = size / 2;
  const radius = (size - strokeWidth) / 2 - PADDING;
  const rotationOffset = (Date.now() % ROTATE_DURATION) / ROTATE_DURATION;
  const startAngle = (2 * Math.PI) * rotationOffset;
  const endAngle = startAngle + (2 * Math.PI) * progress;
  const ctx = canvas.getContext('2d')!;

  if (shouldInit) {
    canvas.width = size;
    canvas.height = size;

    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth;
  }

  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(centerCoordinate, centerCoordinate, radius, startAngle, endAngle);
  ctx.stroke();
}

export default memo(ProgressSpinner);
