import { memo, useEffect, useLayoutEffect, useMemo, useRef, useSignal, useState } from '../../../lib/teact/teact';

import type { ApiSticker } from '../../../api/types';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { getStickerMediaHash } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { preloadImage } from '../../../util/files';
import { hexToRgb } from '../../../util/switchTheme.ts';
import { REM } from '../helpers/mediaDimensions';

import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import useResizeObserver from '../../../hooks/useResizeObserver';
import useDevicePixelRatio from '../../../hooks/window/useDevicePixelRatio';

import styles from './RadialPatternBackground.module.scss';

type OwnProps = {
  backgroundColors: string[];
  patternIcon?: ApiSticker;
  patternColor?: string;
  patternSize?: number;
  ringsCount?: number;
  ovalFactor?: number;
  withLinearGradient?: boolean;
  className?: string;
  clearBottomSector?: boolean;
  yPosition?: number;
};

const BASE_RING_ITEM_COUNT = 8;
const RING_INCREMENT = 0.5;
const CENTER_EMPTINESS = 0.1;
const MAX_RADIUS = 0.42;
const MIN_SIZE = 4 * REM;

const DEFAULT_PATTERN_SIZE = 20;
const DEFAULT_RINGS_COUNT = 3;
const DEFAULT_OVAL_FACTOR = 1.4;

const RadialPatternBackground = ({
  backgroundColors,
  patternIcon,
  patternColor,
  patternSize = DEFAULT_PATTERN_SIZE,
  ringsCount = DEFAULT_RINGS_COUNT,
  ovalFactor = DEFAULT_OVAL_FACTOR,
  withLinearGradient,
  clearBottomSector,
  className,
  yPosition,
}: OwnProps) => {
  const containerRef = useRef<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>();

  const [getContainerSize, setContainerSize] = useSignal({ width: 0, height: 0 });

  const dpr = useDevicePixelRatio();

  const [emojiImage, setEmojiImage] = useState<HTMLImageElement | undefined>();

  const previewMediaHash = patternIcon && getStickerMediaHash(patternIcon, 'preview');
  const previewUrl = useMedia(previewMediaHash);

  useEffect(() => {
    if (!previewUrl) return;
    preloadImage(previewUrl).then(setEmojiImage);
  }, [previewUrl]);

  const patternPositions = useMemo(() => {
    const coordinates: { x: number; y: number; sizeFactor: number }[] = [];
    for (let ring = 1; ring <= ringsCount; ring++) {
      const ringItemCount = Math.floor(BASE_RING_ITEM_COUNT * (1 + (ring - 1) * RING_INCREMENT));
      const ringProgress = ring / ringsCount;
      const ringRadius = CENTER_EMPTINESS + (MAX_RADIUS - CENTER_EMPTINESS) * ringProgress;
      const angleShift = ring % 2 === 0 ? Math.PI / ringItemCount : 0;

      for (let i = 0; i < ringItemCount; i++) {
        const angle = (i / ringItemCount) * Math.PI * 2 + angleShift;

        if (clearBottomSector && angle > Math.PI * 0.45 && angle < Math.PI * 0.55) {
          continue;
        }

        const xOffset = ringRadius * Math.cos(angle) * ovalFactor;
        const yOffset = ringRadius * Math.sin(angle);
        const sizeFactor = 1.65 - ringProgress + Math.random() / ringsCount;

        coordinates.push({
          x: xOffset,
          y: yOffset,
          sizeFactor,
        });
      }
    }
    return coordinates;
  }, [clearBottomSector, ovalFactor, ringsCount]);

  useResizeObserver(containerRef, (entry) => {
    setContainerSize({
      width: entry.contentRect.width,
      height: entry.contentRect.height,
    });
  });

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    }
  }, [setContainerSize]);

  const draw = useLastCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !emojiImage) return;
    const ctx = canvas.getContext('2d')!;
    const { width, height } = canvas;
    if (!width || !height) return;

    const centerX = width / 2;
    const centerY = yPosition !== undefined ? yPosition * dpr : height / 2;

    ctx.clearRect(0, 0, width, height);

    patternPositions.forEach(({
      x, y, sizeFactor,
    }) => {
      const renderX = x * Math.max(width, MIN_SIZE * dpr) + centerX;
      const renderY = yPosition !== undefined ? y * Math.max(width, MIN_SIZE * dpr) + centerY
        : y * Math.max(height, MIN_SIZE * dpr) + centerY;
      const size = patternSize * dpr * sizeFactor;

      ctx.drawImage(emojiImage, renderX - size / 2, renderY - size / 2, size, size);
    });

    ctx.fillStyle = adjustBrightness(backgroundColors[1] ?? backgroundColors[0], -0.075);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillRect(0, 0, width, height);

    const radialGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, width / 2);
    radialGradient.addColorStop(0.75, 'rgb(255 255 255 / 0)');
    radialGradient.addColorStop(1, 'rgb(255 255 255 / 0.75)');

    // Scale around the gradient center
    ctx.translate(centerX, centerY);
    ctx.scale(1, 1 / ovalFactor);
    ctx.translate(-centerX, -centerY);

    // Alpha mask
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = radialGradient;
    // The higher the ovalFactor, the more we need to extend vertically
    const fillHeight = height * ovalFactor;
    ctx.fillRect(0, -fillHeight, width, fillHeight * 2);
  });

  useEffect(() => {
    draw();
  }, [emojiImage, patternColor, patternPositions, yPosition, ovalFactor]);

  useLayoutEffect(() => {
    const { width, height } = getContainerSize();
    const canvas = canvasRef.current;
    if (!width || !height || !canvas) {
      return;
    }

    requestMutation(() => {
      canvas.width = width * dpr;
      canvas.height = height * dpr;

      draw();
    });
  }, [getContainerSize, dpr]);

  return (
    <div
      ref={containerRef}
      className={buildClassName(styles.root, withLinearGradient && styles.withLinearGradient, className)}
      style={buildStyle(
        `--_bg-light: ${backgroundColors[0]}`,
        `--_bg-dark: ${backgroundColors[1] ?? backgroundColors[0]}`,
        yPosition !== undefined && `--_y-shift: ${yPosition}px`,
      )}
    >
      <canvas
        ref={canvasRef}
        className={buildClassName(styles.canvas, emojiImage && styles.showing)}
        aria-hidden="true"
      />
    </div>
  );
};

export default memo(RadialPatternBackground);

function adjustBrightness(hex: string, delta: number) {
  const factor = 1 + delta;
  const rgba = hexToRgb(hex);
  const darkenedRgba = [
    Math.min(255, Math.round(rgba.r * factor)),
    Math.min(Math.round(rgba.g * factor)),
    Math.min(Math.round(rgba.b * factor)),
    rgba.a ?? 1,
  ] as const;

  return rgbaToHex(...darkenedRgba);
}

function rgbaToHex(r: number, g: number, b: number, a: number) {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}${Math.round(a * 255).toString(16)}`;
}
