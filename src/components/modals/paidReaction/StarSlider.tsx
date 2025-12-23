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
const THUMB_SIZE_IN_PIXELS = 1.875 * REM;
const BEAK_WIDTH_IN_PIXELS = 28;
const DEFAULT_RADIUS_IN_REM = 2;
const MIN_RADIUS_IN_REM = 0.375;

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
    minBadgeX, maxBadgeX, beakOffset, cornerRadius,
  } = useMemo(() => {
    return calcBadgePosition(containerWidth, badgeWidth, progress);
  }, [containerWidth, badgeWidth, progress]);

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

  const { left: radiusLeft, right: radiusRight } = cornerRadius;
  const dynamicColor = shouldUseDynamicColor ? getColorForProgress(progress) : undefined;

  const badgeStyle = buildStyle(
    `border-radius: 2rem 2rem ${radiusRight}rem ${radiusLeft}rem`,
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
            width="28"
            height="28"
            viewBox="0 0 28 28"
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
              d="m 28,4 v 9 c 0.0089,7.283278 -3.302215,5.319646 -6.750951,8.589815 l -5.8284,5.82843 c -0.781,0.78105 -2.0474,0.78104 -2.8284,0 L 6.7638083,21.589815 C 2.8288652,17.959047 0.04527024,20.332086 0,13 V 4 C 0,4 0.00150581,0.97697493 3,1 5.3786658,1.018266 22.594519,0.9142007 25,1 c 2.992326,0.1067311 3,3 3,3 z"
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
  const halfThumbSize = THUMB_SIZE_IN_PIXELS / 2;

  const baseTargetX = halfThumbSize + progress * (containerWidth - THUMB_SIZE_IN_PIXELS);
  const cornerTargetX = progress * containerWidth;

  const edgeZone = THUMB_SIZE_IN_PIXELS / 2;
  const distanceToLeftEdge = cornerTargetX;
  const distanceToRightEdge = containerWidth - cornerTargetX;
  const minEdgeDistance = Math.min(distanceToLeftEdge, distanceToRightEdge);

  const t = Math.min(1, minEdgeDistance / edgeZone);
  const targetX = cornerTargetX + t * (baseTargetX - cornerTargetX);
  const minBadgeX = halfBadgeWidth;
  const maxBadgeX = containerWidth - halfBadgeWidth;
  const clampedBadgeX = Math.max(minBadgeX, Math.min(targetX, maxBadgeX));

  const beakOffset = targetX - clampedBadgeX;

  const thresholdPx = DEFAULT_RADIUS_IN_REM / 2 * REM;
  const beakHalfWidth = BEAK_WIDTH_IN_PIXELS / 2;

  const distanceToEdge = halfBadgeWidth - Math.abs(beakOffset);
  const normalizedDistance = Math.max(0, distanceToEdge - beakHalfWidth);

  let edgeRadius = DEFAULT_RADIUS_IN_REM;
  if (normalizedDistance < thresholdPx) {
    const radiusT = 1 - (normalizedDistance / thresholdPx);
    edgeRadius = DEFAULT_RADIUS_IN_REM - radiusT * (DEFAULT_RADIUS_IN_REM - MIN_RADIUS_IN_REM);
  }

  const leftRadius = beakOffset < 0 ? edgeRadius : DEFAULT_RADIUS_IN_REM;
  const rightRadius = beakOffset > 0 ? edgeRadius : DEFAULT_RADIUS_IN_REM;

  return {
    minBadgeX,
    maxBadgeX,
    beakOffset,
    cornerRadius: { left: leftRadius, right: rightRadius },
  };
}

export default memo(StarSlider);
