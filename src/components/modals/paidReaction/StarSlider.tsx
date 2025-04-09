import React, {
  memo, useMemo, useRef, useState,
} from '../../../lib/teact/teact';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import buildClassName from '../../../util/buildClassName';
import { formatInteger } from '../../../util/textFormat';

import useEffectOnce from '../../../hooks/useEffectOnce';
import useLastCallback from '../../../hooks/useLastCallback';
import useResizeObserver from '../../../hooks/useResizeObserver';

import AnimatedCounter from '../../common/AnimatedCounter';
import Icon from '../../common/icons/Icon';
import Sparkles from '../../common/Sparkles';

import styles from './StarSlider.module.scss';

type OwnProps = {
  maxValue: number;
  defaultValue: number;
  className?: string;
  onChange: (value: number) => void;
};

const DEFAULT_POINTS = [50, 100, 500, 1000, 2000, 5000, 10000];

const StarSlider = ({
  maxValue,
  defaultValue,
  className,
  onChange,
}: OwnProps) => {
  // eslint-disable-next-line no-null/no-null
  const floatingBadgeRef = useRef<HTMLDivElement>(null);

  const points = useMemo(() => {
    const result = [];
    for (let i = 0; i < DEFAULT_POINTS.length; i++) {
      if (DEFAULT_POINTS[i] < maxValue) {
        result.push(DEFAULT_POINTS[i]);
      }

      if (DEFAULT_POINTS[i] >= maxValue) {
        result.push(maxValue);
        break;
      }
    }

    return result;
  }, [maxValue]);

  const [value, setValue] = useState(0);

  useEffectOnce(() => {
    setValue(getProgress(points, defaultValue));
  });

  const updateSafeBadgePosition = useLastCallback(() => {
    const badge = floatingBadgeRef.current;
    if (!badge) return;
    const parent = badge.parentElement!;

    requestMeasure(() => {
      const safeMinX = parent.offsetLeft + badge.offsetWidth / 2;
      const safeMaxX = parent.offsetLeft + parent.offsetWidth - badge.offsetWidth / 2;

      requestMutation(() => {
        parent.style.setProperty('--_min-x', `${safeMinX}px`);
        parent.style.setProperty('--_max-x', `${safeMaxX}px`);
      });
    });
  });

  useResizeObserver(floatingBadgeRef, updateSafeBadgePosition);

  const handleChange = useLastCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(event.currentTarget.value);
    setValue(newValue);

    onChange(getValue(points, newValue));
  });

  return (
    <div className={buildClassName(styles.root, className)} style={`--progress: ${value / points.length}`}>
      <div className={styles.floatingBadgeWrapper}>
        <div className={styles.floatingBadge} ref={floatingBadgeRef}>
          <div className={styles.floatingBadgeText}>
            <Icon name="star" className={styles.floatingBadgeIcon} />
            <AnimatedCounter text={formatInteger(getValue(points, value))} />
          </div>
          <svg className={styles.floatingBadgeTriangle} width="28" height="28" viewBox="0 0 28 28" fill="none">
            <defs>
              <linearGradient id="StarBadgeTriangle" x1="0" x2="1" y1="0" y2="0">
                <stop offset="-50%" stop-color="#FFAA00" />
                <stop offset="150%" stop-color="#FFCD3A" />
              </linearGradient>
            </defs>
            <path d="m 28,4 v 9 c 0.0089,7.283278 -3.302215,5.319646 -6.750951,8.589815 l -5.8284,5.82843 c -0.781,0.78105 -2.0474,0.78104 -2.8284,0 L 6.7638083,21.589815 C 2.8288652,17.959047 0.04527024,20.332086 0,13 V 4 C 0,4 0.00150581,0.97697493 3,1 5.3786658,1.018266 22.594519,0.9142007 25,1 c 2.992326,0.1067311 3,3 3,3 z" fill="url(#StarBadgeTriangle)" />
          </svg>
        </div>
      </div>
      <div className={styles.progress}>
        <Sparkles preset="progress" className={styles.sparkles} />
      </div>
      <input
        className={styles.slider}
        type="range"
        min={0}
        max={points.length}
        defaultValue={getProgress(points, defaultValue)}
        step="any"
        onChange={handleChange}
      />
    </div>
  );
};

function getProgress(points: number[], value: number) {
  const pointIndex = points.findIndex((point) => value <= point);
  const prevPoint = points[pointIndex - 1] || 1;
  const nextPoint = points[pointIndex] || points[points.length - 1];
  const progress = (value - prevPoint) / (nextPoint - prevPoint);
  return pointIndex + progress;
}

function getValue(points: number[], progress: number) {
  const pointIndex = Math.floor(progress);
  const prevPoint = points[pointIndex - 1] || 1;
  const nextPoint = points[pointIndex] || points[points.length - 1];
  const value = prevPoint + (nextPoint - prevPoint) * (progress - pointIndex);
  return Math.round(value);
}

export default memo(StarSlider);
