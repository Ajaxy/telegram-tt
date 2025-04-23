import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';
import { formatStarsAsText } from '../../../util/localization/format';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../icons/Icon';

type OwnProps = {
  min?: number;
  max: number;
  value: number;
  disabled?: boolean;
  readOnly?: boolean;
  bold?: boolean;
  className?: string;
  defaultValue: number;
  onChange: (value: number) => void;
  canChangeChargeForMessages?: boolean;
};

const DEFAULT_POINTS = [50, 100, 500, 1000, 2000, 5000, 10000];

const PaidMessageSlider: FC<OwnProps> = ({
  min = 0,
  max,
  value,
  disabled,
  readOnly,
  bold,
  className,
  defaultValue,
  onChange,
  canChangeChargeForMessages,
}) => {
  const lang = useLang();

  const points = useMemo(() => {
    const result = [];
    for (let i = 0; i < DEFAULT_POINTS.length; i++) {
      if (DEFAULT_POINTS[i] < max) {
        result.push(DEFAULT_POINTS[i]);
      }

      if (DEFAULT_POINTS[i] >= max) {
        result.push(max);
        break;
      }
    }

    return result;
  }, [max]);

  const handleChange = useLastCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(event.currentTarget.value);
    onChange(getValue(points, newValue));
  });

  const mainClassName = buildClassName(
    className,
    'RangeSlider',
    disabled && 'disabled',
    readOnly && 'readOnly',
    bold && 'bold',
  );

  function renderTopRow() {
    return (
      <div className="slider-top-row" dir={lang.isRtl ? 'rtl' : undefined}>
        <span className="value-min" dir="auto">{lang.number(min)}</span>
        <span className="settings-range-value">
          {!canChangeChargeForMessages && (<Icon name="lock-badge" />)}
          {formatStarsAsText(lang, getValue(points, getProgress(points, value)))}
        </span>
        <span className="value-max" dir="auto">{lang.number(max)}</span>
      </div>
    );
  }

  return (
    <div className={mainClassName}>
      {renderTopRow()}
      <div className="slider-main">
        <div
          className="slider-fill-track"
          style={`width: ${(getProgress(points, value) / points.length) * 100}%`}
        />
        <input
          min={0}
          max={points.length}
          defaultValue={getProgress(points, defaultValue)}
          step="any"
          type="range"
          className="RangeSlider__input"
          onChange={handleChange}
        />
      </div>
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
  const pointValue = prevPoint + (nextPoint - prevPoint) * (progress - pointIndex);
  return pointValue < 100 ? Math.round(pointValue) : Math.round(pointValue / 10) * 10;
}

export default memo(PaidMessageSlider);
