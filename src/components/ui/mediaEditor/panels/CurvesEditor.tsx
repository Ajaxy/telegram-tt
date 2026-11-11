import {
  memo, useLayoutEffect, useRef, useState, useUnmountCleanup,
} from '@teact';

import type { CurveChannel, CurveLevels, CurvesState } from '../../../../types/mediaEditor';
import type { Size } from '../render/transform';

import getPointerPosition from '../../../../util/events/getPointerPosition';
import { clamp } from '../../../../util/math';
import { DEFAULT_CURVE_LEVELS, getCurveValue } from '../render/adjustments/curves';

import useLastCallback from '../../../../hooks/useLastCallback';
import useResizeObserver from '../../../../hooks/useResizeObserver';
import useWindow from '../../../../hooks/useWindow';

import styles from '../MediaEditor.module.scss';

type OwnProps = {
  curves?: CurvesState;
  channel: CurveChannel;
  onPreview: (curves: CurvesState) => void;
  onCommit: (curves: CurvesState) => void;
};

const CHANNEL_COLORS: Record<Exclude<CurveChannel, 'all'>, string> = {
  red: '#ED3D4C',
  green: '#10EE9D',
  blue: '#3377FB',
};
const CURVE_SAMPLES = 100;
const LINE_WIDTH = 2;
const GUIDE_ALPHA = 0.2;
const IDENTITY_ALPHA = 0.5;
const IDENTITY_DASH = [5, 4];

function CurvesEditor({
  curves,
  channel,
  onPreview,
  onCommit,
}: OwnProps) {
  const renderingWindow = useWindow();
  const canvasRef = useRef<HTMLCanvasElement>();
  const removeListenersRef = useRef<NoneToVoidFunction>();
  const [size, setSize] = useState<Size>();
  const [textColor, setTextColor] = useState<string>();
  const levels = curves?.[channel] ?? DEFAULT_CURVE_LEVELS;

  useResizeObserver(canvasRef, ({ contentRect, target }) => {
    setSize({ width: contentRect.width, height: contentRect.height });
    setTextColor(getComputedStyle(target).color);
  });

  useUnmountCleanup(() => removeListenersRef.current?.());

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size || !textColor) return;

    const { width, height } = size;
    const dpr = window.devicePixelRatio;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const color = channel === 'all' ? textColor : CHANNEL_COLORS[channel];
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    ctx.globalAlpha = GUIDE_ALPHA;
    for (let i = 1; i < DEFAULT_CURVE_LEVELS.length; i++) {
      const x = (width / DEFAULT_CURVE_LEVELS.length) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    ctx.globalAlpha = IDENTITY_ALPHA;
    ctx.strokeStyle = textColor;
    ctx.setLineDash(IDENTITY_DASH);
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, 0);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = LINE_WIDTH;
    ctx.beginPath();
    for (let i = 0; i <= CURVE_SAMPLES; i++) {
      const x = i / CURVE_SAMPLES;
      const y = getCurveValue(levels, x);
      ctx.lineTo(x * width, (1 - y) * height);
    }
    ctx.stroke();
  }, [size, textColor, levels, channel]);

  const updateChannel = (newLevels?: CurveLevels): CurvesState => ({ ...curves, [channel]: newLevels });

  const handlePointerDown = useLastCallback((e: React.MouseEvent | React.TouchEvent) => {
    removeListenersRef.current?.();

    const canvas = canvasRef.current!;
    const targetDocument = renderingWindow.document;
    const rect = canvas.getBoundingClientRect();
    const start = getPointerPosition(e);
    const zone = clamp(Math.floor(((start.x - rect.left) / rect.width) * levels.length), 0, levels.length - 1);
    const startLevel = levels[zone];
    let lastCurves: CurvesState | undefined;

    const handleMove = (event: MouseEvent | TouchEvent) => {
      const { y } = getPointerPosition(event);
      const newLevels: CurveLevels = [...levels];
      newLevels[zone] = Math.round(clamp(startLevel - ((y - start.y) / rect.height) * 100, 0, 100));
      lastCurves = updateChannel(newLevels);
      onPreview(lastCurves);
    };

    const removeListeners = () => {
      targetDocument.removeEventListener('mousemove', handleMove);
      targetDocument.removeEventListener('mouseup', handleUp);
      targetDocument.removeEventListener('touchmove', handleMove);
      targetDocument.removeEventListener('touchend', handleUp);
      targetDocument.removeEventListener('touchcancel', handleUp);
      removeListenersRef.current = undefined;
    };

    function handleUp() {
      removeListeners();
      if (lastCurves) onCommit(lastCurves);
    }

    targetDocument.addEventListener('mousemove', handleMove);
    targetDocument.addEventListener('mouseup', handleUp);
    targetDocument.addEventListener('touchmove', handleMove);
    targetDocument.addEventListener('touchend', handleUp);
    targetDocument.addEventListener('touchcancel', handleUp);
    removeListenersRef.current = removeListeners;
  });

  const handleDoubleClick = useLastCallback(() => {
    onCommit(updateChannel(undefined));
  });

  return (
    <div className={styles.curvesEditor}>
      <canvas
        ref={canvasRef}
        className={styles.curvesCanvas}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        onDoubleClick={handleDoubleClick}
      />
      <div className={styles.curvesLabels}>
        {levels.map((level, i) => (
          <span key={i} className={styles.curvesLabel}>{(level / 100).toFixed(2)}</span>
        ))}
      </div>
    </div>
  );
}

export default memo(CurvesEditor);
