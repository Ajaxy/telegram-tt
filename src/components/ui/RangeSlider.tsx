import { ChangeEvent } from 'react';
import React, {
  FC, useCallback, useMemo, memo,
} from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';

import './RangeSlider.scss';

type OwnProps = {
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
};

const RangeSlider: FC<OwnProps> = ({
  options,
  min = 0,
  max = options ? options.length - 1 : 100,
  step = 1,
  label,
  value,
  disabled,
  onChange,
}) => {
  const lang = useLang();
  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    onChange(Number(event.currentTarget.value));
  }, [onChange]);

  const className = buildClassName(
    'RangeSlider',
    disabled && 'disabled',
  );

  const trackWidth = useMemo(() => {
    if (options) {
      return (value / (options.length - 1)) * 100;
    } else {
      const possibleValuesLength = (max - min) / step;
      return ((value - min) / possibleValuesLength) * 100;
    }
    return 0;
  }, [options, value, max, min, step]);

  return (
    <div className={className}>
      {label && (
        <div className="slider-top-row" dir={lang.isRtl ? 'rtl' : undefined}>
          <span className="label" dir="auto">{label}</span>
          {!options && (
            <span className="value" dir="auto">{value}</span>
          )}
        </div>
      )}
      <div className="slider-main">
        <div
          className="slider-fill-track"
          // @ts-ignore
          style={`width: ${trackWidth}%`}
        />
        <input
          min={min}
          max={max}
          value={value}
          step={step}
          type="range"
          onChange={handleChange}
        />
        {options && (
          <div className="slider-options">
            {options.map((option, index) => (
              <div
                className={buildClassName('slider-option no-selection', index === value && 'active')}
                onClick={() => onChange(index)}
              >
                {option}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(RangeSlider);
