import React, {
  memo, useEffect, useMemo, useRef, useSignal, useState,
} from '../../../lib/teact/teact';

import type { ApiSticker } from '../../../api/types';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { getStickerMediaHash } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { preloadImage } from '../../../util/files';

import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import useResizeObserver from '../../../hooks/useResizeObserver';
import useDevicePixelRatio from '../../../hooks/window/useDevicePixelRatio';

import styles from './RadialPatternBackground.module.scss';

type OwnProps = {
  backgroundColors: string[];
  patternColor?: string;
  patternIcon?: ApiSticker;
  className?: string;
  clearBottomSector?: boolean;
};

const RINGS = 3;
const BASE_RING_ITEM_COUNT = 8;
const RING_INCREMENT = 0.5;
const CENTER_EMPTINESS = 0.05;
const MAX_RADIUS = 0.4;
const BASE_ICON_SIZE = 20;

const MIN_SIZE = 250;

const RadialPatternBackground = ({
  backgroundColors,
  patternColor,
  patternIcon,
  clearBottomSector,
  className,
}: OwnProps) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    for (let ring = 1; ring <= RINGS; ring++) {
      const ringItemCount = Math.floor(BASE_RING_ITEM_COUNT * (1 + (ring - 1) * RING_INCREMENT));
      const ringProgress = ring / RINGS;
      const ringRadius = CENTER_EMPTINESS + (MAX_RADIUS - CENTER_EMPTINESS) * ringProgress;

      const angleShift = ring % 2 === 0 ? Math.PI / ringItemCount : 0;

      for (let i = 0; i < ringItemCount; i++) {
        const angle = (i / ringItemCount) * Math.PI * 2 + angleShift;

        if (clearBottomSector && angle > Math.PI * 0.45 && angle < Math.PI * 0.55) {
          continue;
        }

        // Slightly oval
        const xOffset = ringRadius * 1.71 * Math.cos(angle);
        const yOffset = ringRadius * Math.sin(angle);

        const x = 0.5 + xOffset;
        const y = 0.5 + yOffset;

        const sizeFactor = 1.4 - ringProgress * Math.random();

        coordinates.push({
          x, y, sizeFactor,
        });
      }
    }
    return coordinates;
  }, [clearBottomSector]);

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

    ctx.save();
    patternPositions.forEach(({
      x, y, sizeFactor,
    }) => {
      const centerShift = (width - Math.max(width, MIN_SIZE * dpr)) / 2; // Shift coords if canvas is smaller than `MIN_SIZE`
      const renderX = x * Math.max(width, MIN_SIZE * dpr) + centerShift;
      const renderY = y * Math.max(height, MIN_SIZE * dpr) + centerShift;

      const size = BASE_ICON_SIZE * dpr * sizeFactor * (centerShift ? 0.8 : 1);

      ctx.drawImage(emojiImage, renderX - size / 2, renderY - size / 2, size, size);
    });
    ctx.restore();

    if (patternColor) {
      ctx.save();
      ctx.fillStyle = patternColor;
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    const radialGradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2);
    radialGradient.addColorStop(0, '#FFFFFF77');
    radialGradient.addColorStop(1, '#FFFFFF');

    // Alpha mask
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = radialGradient;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  });

  useEffect(() => {
    draw();
  }, [emojiImage]);

  useEffect(() => {
    const { width, height } = getContainerSize();
    const canvas = canvasRef.current!;
    if (!width || !height) {
      return;
    }

    const maxSide = Math.max(width, height);
    requestMutation(() => {
      canvas.width = maxSide * dpr;
      canvas.height = maxSide * dpr;

      draw();
    });
  }, [getContainerSize, dpr]);

  return (
    <div
      ref={containerRef}
      className={buildClassName(styles.root, className)}
      style={buildStyle(
        `--_bg-1: ${backgroundColors[0]}`,
        `--_bg-2: ${backgroundColors[1] || backgroundColors[0]}`,
      )}
    >
      <canvas className={styles.canvas} ref={canvasRef} />
    </div>
  );
};

export default memo(RadialPatternBackground);
