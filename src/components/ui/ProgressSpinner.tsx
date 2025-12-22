import { memo, useEffect, useRef } from '../../lib/teact/teact';

import { requestMutation } from '../../lib/fasterdom/fasterdom';
import { animate, timingFunctions } from '../../util/animation';
import buildClassName from '../../util/buildClassName';

import useDynamicColorListener from '../../hooks/stickers/useDynamicColorListener';
import { useStateRef } from '../../hooks/useStateRef';
import useDevicePixelRatio from '../../hooks/window/useDevicePixelRatio';

import Icon from '../common/icons/Icon';

import './ProgressSpinner.scss';

type OwnProps = {
  progress?: number;
  size?: 's' | 'm' | 'l' | 'xl';
  square?: boolean;
  transparent?: boolean;
  noCross?: boolean;
  rotationOffset?: number;
  withColor?: boolean;
  onClick?: (e: React.MouseEvent<HTMLElement, MouseEvent>) => void;
};

const SIZES = {
  s: 42, m: 48, l: 54, xl: 52,
};
const STROKE_WIDTH = 2;
const STROKE_WIDTH_XL = 3;
const PADDING = 2;
const MIN_PROGRESS = 0.05;
const MAX_PROGRESS = 1;
const GROW_DURATION = 600; // 0.6 s
const ROTATE_DURATION = 2000; // 2 s

const ProgressSpinner = ({
  progress = 0,
  size = 'l',
  square,
  transparent,
  noCross,
  rotationOffset,
  withColor,
  onClick,
}: OwnProps) => {
  const canvasRef = useRef<HTMLCanvasElement>();
  const width = SIZES[size];
  const progressRef = useStateRef(progress);

  const dpr = useDevicePixelRatio();

  const color = useDynamicColorListener(canvasRef, undefined, !withColor);

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
        width * dpr,
        (size === 'xl' ? STROKE_WIDTH_XL : STROKE_WIDTH) * dpr,
        color ?? 'white',
        currentProgress,
        dpr,
        isFirst,
        rotationOffset,
      );

      isFirst = false;

      return currentProgress < 1;
    }, requestMutation);
  }, [progressRef, size, width, dpr, rotationOffset, color]);

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
      {!noCross && <Icon name="close" />}
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
  dpr: number,
  shouldInit = false,
  rotationOffset?: number,
) {
  const centerCoordinate = size / 2;
  const radius = (size - strokeWidth) / 2 - PADDING * dpr;
  const offset = rotationOffset ?? (Date.now() % ROTATE_DURATION) / ROTATE_DURATION;
  const startAngle = (2 * Math.PI) * offset;
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
