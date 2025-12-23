import type { TeactNode } from '../../../lib/teact/teact';
import {
  memo, useEffect,
  useMemo, useRef, useState } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { REM } from '../../common/helpers/mediaDimensions';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import usePrevious from '../../../hooks/usePrevious';
import useResizeObserver from '../../../hooks/useResizeObserver';

import AnimatedCounter from '../../common/AnimatedCounter';
import Icon from '../../common/icons/Icon';
import Sparkles from '../../common/Sparkles';

import styles from './StarSlider.module.scss';

type OwnProps = {
  maxValue: number;
  defaultValue: number;
  minValue?: number;
  minAllowedValue?: number;
  className?: string;
  floatingBadgeDescription?: TeactNode;
  shouldUseDynamicColor?: boolean;
  shouldAllowCustomValue?: boolean;
  onChange: (value: number) => void;
  onBadgeClick?: NoneToVoidFunction;
};

const DEFAULT_POINTS = [50, 100, 500, 1000, 2000, 5000, 10000];
const LARGE_STEP = 10000;
const THUMB_SIZE = 1.875 * REM;
const CORNER_BEAK_WIDTH = 44;
const DEFAULT_BEAK_WIDTH = 52;
const BEAK_HEIGHT = 32;

const BEAK_OFFSET_END = 10;
const TIP_OFFSET_END = 0;

const BADGE_HORIZONTAL_PADDING = 2 * REM;
const BADGE_ICON_SIZE = 1.5 * REM;
const BADGE_TITLE_GAP = 0.125 * REM;
const DRAG_DISTANCE_THRESHOLD = 5;
const BADGE_WIDTH_DELTA = 6;

let textMeasureCanvas: HTMLCanvasElement | undefined;

function getTextWidth(text: string, font: string): number {
  if (!textMeasureCanvas) {
    textMeasureCanvas = document.createElement('canvas');
  }
  const ctx = textMeasureCanvas.getContext('2d')!;
  ctx.font = font;
  return ctx.measureText(text).width;
}

const SLIDER_COLORS = [
  '#955CDB', // Purple
  '#955CDB', // Purple
  '#46A3EB', // Blue
  '#40A920', // Green
  '#E29A09', // Yellow
  '#ED771E', // Orange
  '#E14542', // Red
  '#596473', // Silver (100% only)
];

function getColorForProgress(progress: number): string {
  if (progress >= 1) return SLIDER_COLORS[SLIDER_COLORS.length - 1];

  const regularColorsCount = SLIDER_COLORS.length - 1;
  const index = Math.floor(progress * regularColorsCount);
  return SLIDER_COLORS[Math.min(index, regularColorsCount - 1)];
}

const StarSlider = ({
  maxValue,
  defaultValue,
  minValue,
  minAllowedValue,
  className,
  floatingBadgeDescription,
  shouldUseDynamicColor,
  shouldAllowCustomValue,
  onChange,
  onBadgeClick,
}: OwnProps) => {
  const containerRef = useRef<HTMLDivElement>();
  const floatingBadgeContentRef = useRef<HTMLDivElement>();
  const lang = useLang();

  const min = minValue ?? 1;

  const points = useMemo(() => {
    const result = [];

    for (let i = 0; i < DEFAULT_POINTS.length; i++) {
      if (DEFAULT_POINTS[i] <= min) continue;

      if (DEFAULT_POINTS[i] < maxValue) {
        result.push(DEFAULT_POINTS[i]);
      }

      if (DEFAULT_POINTS[i] >= maxValue) {
        result.push(maxValue);
        return result;
      }
    }

    const lastPoint = DEFAULT_POINTS[DEFAULT_POINTS.length - 1];
    let nextPoint = lastPoint + LARGE_STEP;
    while (nextPoint < maxValue) {
      result.push(nextPoint);
      nextPoint += LARGE_STEP;
    }
    result.push(maxValue);

    return result;
  }, [maxValue, min]);

  const [value, setValue] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [badgeWidth, setBadgeWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef<number | undefined>();
  const prevBadgeWidth = usePrevious(badgeWidth);

  const badgeText = lang.number(getValue(points, value, min));

  const minAllowedProgress = minAllowedValue !== undefined
    ? getProgress(points, minAllowedValue, min) : 0;

  useEffect(() => {
    setValue(getProgress(points, defaultValue, min));
  }, [defaultValue, points, min]);

  useEffect(() => {
    if (!floatingBadgeContentRef.current) return;

    const titleEl = floatingBadgeContentRef.current.querySelector(`.${styles.floatingBadgeTitle}`);
    if (!titleEl) return;

    const computedStyle = getComputedStyle(titleEl);
    const font = `${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`;

    const textWidth = getTextWidth(badgeText, font);
    const titleWidth = BADGE_ICON_SIZE + BADGE_TITLE_GAP + textWidth;

    const descriptionEl = floatingBadgeContentRef.current.querySelector(`.${styles.floatingBadgeDescription}`);
    const descriptionWidth = descriptionEl?.scrollWidth || 0;

    const contentWidth = Math.max(titleWidth, descriptionWidth);
    const newBadgeWidth = contentWidth + BADGE_HORIZONTAL_PADDING;

    setBadgeWidth((currentWidth) => {
      if (Math.abs(newBadgeWidth - currentWidth) < BADGE_WIDTH_DELTA) {
        return currentWidth;
      }
      return newBadgeWidth;
    });
  }, [badgeText, floatingBadgeDescription]);

  const handleContainerResize = useLastCallback((entry: ResizeObserverEntry) => {
    setContainerWidth(entry.contentRect.width);
  });

  useResizeObserver(containerRef, handleContainerResize);

  const progress = value / points.length;
  const {
    minBadgeX, maxBadgeX, beakOffset, beakTipOffset, beakWidth: currentBeakWidth,
  } = useMemo(() => {
    return calcBadgePosition(containerWidth, badgeWidth, progress);
  }, [containerWidth, badgeWidth, progress]);

  const beakPath = useMemo(() => {
    return generateBeakPath(currentBeakWidth, beakTipOffset);
  }, [currentBeakWidth, beakTipOffset]);

  const handleChange = useLastCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = Number(event.currentTarget.value);
    const clampedValue = Math.max(rawValue, minAllowedProgress);
    setValue(clampedValue);

    const resultValue = getValue(points, clampedValue, min);
    onChange(resultValue);
  });

  const handlePointerDown = useLastCallback((e: React.PointerEvent<HTMLInputElement>) => {
    startXRef.current = e.clientX;
    setIsDragging(false);
  });

  const handlePointerMove = useLastCallback((e: React.PointerEvent<HTMLInputElement>) => {
    if (startXRef.current === undefined) return;
    const distance = Math.abs(e.clientX - startXRef.current);
    if (distance >= DRAG_DISTANCE_THRESHOLD) {
      setIsDragging(true);
    }
  });

  const handlePointerUp = useLastCallback(() => {
    startXRef.current = undefined;
    setIsDragging(false);
  });

  const dynamicColor = shouldUseDynamicColor ? getColorForProgress(progress) : undefined;

  const badgeStyle = buildStyle(
    Boolean(badgeWidth) && `width: ${badgeWidth}px`,
  );

  const rootStyle = buildStyle(
    `--progress: ${progress}`,
    `--min-badge-x: ${minBadgeX}px`,
    `--max-badge-x: ${maxBadgeX}px`,
    dynamicColor && `--dynamic-color: ${dynamicColor}`,
  );

  return (
    <div
      ref={containerRef}
      className={buildClassName(styles.root, isDragging && styles.dragging, className)}
      style={rootStyle}
    >
      <div className={styles.floatingBadgeWrapper}>
        <div
          className={buildClassName(styles.floatingBadge, onBadgeClick && styles.clickable)}
          onClick={onBadgeClick}
        >
          <div
            className={buildClassName(
              styles.floatingBadgeText,
              shouldUseDynamicColor && styles.dynamicColor,
              (!prevBadgeWidth || prevBadgeWidth === 0) && styles.noTransition,
            )}
            style={badgeStyle}
          >
            <Sparkles preset="button" className={styles.floatingBadgeSparkles} />
            <div
              ref={floatingBadgeContentRef}
              className={buildClassName(
                styles.floatingBadgeContent,
                floatingBadgeDescription && styles.withDescription,
              )}
            >
              <div className={styles.floatingBadgeTitle}>
                <Icon name="star" className={styles.floatingBadgeIcon} />
                <AnimatedCounter text={badgeText} />
              </div>
              <div className={styles.floatingBadgeDescription}>
                {floatingBadgeDescription}
              </div>
            </div>
          </div>
          <svg
            className={styles.floatingBadgeTriangle}
            width={currentBeakWidth}
            height={BEAK_HEIGHT}
            viewBox={`0 0 ${currentBeakWidth} ${BEAK_HEIGHT}`}
            fill="none"
            aria-hidden="true"
            role="presentation"
            style={`transform: translate(calc(-50% + ${beakOffset}px), 33%)`}
          >
            {!shouldUseDynamicColor && (
              <defs>
                <linearGradient id="StarBadgeTriangle" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="-50%" stop-color="#FFAA00" />
                  <stop offset="150%" stop-color="#FFCD3A" />
                </linearGradient>
              </defs>
            )}
            <path
              className={styles.floatingBadgeTrianglePath}
              d={beakPath}
              fill={dynamicColor || 'url(#StarBadgeTriangle)'}
            />
          </svg>
        </div>
      </div>
      <div className={buildClassName(styles.progress, shouldUseDynamicColor && styles.dynamicColor)}>
        <Sparkles preset="progress" className={styles.sparkles} />
      </div>
      <input
        className={styles.slider}
        type="range"
        min={0}
        max={points.length}
        defaultValue={getProgress(points, defaultValue, min)}
        step="any"
        onChange={handleChange}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      {shouldAllowCustomValue && (
        <Icon name="add" className={styles.customValueIcon} />
      )}
    </div>
  );
};

function getProgress(points: number[], value: number, minValue: number) {
  const pointIndex = points.findIndex((point) => value <= point);
  const prevPoint = points[pointIndex - 1] || minValue;
  const nextPoint = points[pointIndex] || points[points.length - 1];
  if (nextPoint === prevPoint) return pointIndex;
  const progress = (value - prevPoint) / (nextPoint - prevPoint);
  return pointIndex + progress;
}

function getValue(points: number[], progress: number, minValue: number) {
  const pointIndex = Math.floor(progress);
  const prevPoint = points[pointIndex - 1] || minValue;
  const nextPoint = points[pointIndex] || points[points.length - 1];
  const value = prevPoint + (nextPoint - prevPoint) * (progress - pointIndex);
  return Math.round(value);
}

function calcBadgePosition(
  containerWidth: number,
  badgeWidth: number,
  progress: number,
) {
  const halfBadgeWidth = badgeWidth / 2;
  const cornerBeakHalfWidth = CORNER_BEAK_WIDTH / 2;
  const maxBeakOffset = halfBadgeWidth - cornerBeakHalfWidth;

  const minBadgeX = halfBadgeWidth;
  const maxBadgeX = containerWidth - halfBadgeWidth;

  const thumbHalf = THUMB_SIZE / 2;
  const trackLength = containerWidth - THUMB_SIZE;
  const distanceFromLeft = progress * trackLength;
  const distanceFromRight = trackLength - distanceFromLeft;

  const isLeftSide = distanceFromLeft < distanceFromRight;
  const distanceToEdge = isLeftSide ? distanceFromLeft : distanceFromRight;
  const direction = isLeftSide ? -1 : 1;

  let beakOffset = 0;
  let beakTipOffset = 0;
  let beakWidth = DEFAULT_BEAK_WIDTH;

  const beakOffsetStart = halfBadgeWidth - thumbHalf;

  if (distanceToEdge < beakOffsetStart) {
    if (distanceToEdge > BEAK_OFFSET_END) {
      const t = (beakOffsetStart - distanceToEdge) / (beakOffsetStart - BEAK_OFFSET_END);
      beakOffset = direction * t * maxBeakOffset;
    } else if (distanceToEdge > TIP_OFFSET_END) {
      beakOffset = direction * maxBeakOffset;
      const t = (BEAK_OFFSET_END - distanceToEdge) / (BEAK_OFFSET_END - TIP_OFFSET_END);
      const tExp = 1 - (1 - t) * (1 - t) * (1 - t);
      beakWidth = DEFAULT_BEAK_WIDTH - tExp * (DEFAULT_BEAK_WIDTH - CORNER_BEAK_WIDTH);
      beakTipOffset = direction * t * (beakWidth / 2);
    } else {
      beakOffset = direction * maxBeakOffset;
      beakWidth = CORNER_BEAK_WIDTH;
      beakTipOffset = direction * (beakWidth / 2);
    }
  }

  return {
    minBadgeX,
    maxBadgeX,
    beakOffset,
    beakTipOffset,
    beakWidth,
  };
}

const TIP_RADIUS = 2;

function generateBeakPath(beakWidth: number, tipOffset: number): string {
  const tipX = beakWidth / 2 + tipOffset;
  const r = TIP_RADIUS;
  const y = BEAK_HEIGHT - r;

  return `M 0 0 L ${beakWidth} 0 L ${tipX + r} ${y} Q ${tipX} ${BEAK_HEIGHT} ${tipX - r} ${y} Z`;
}

export default memo(StarSlider);
