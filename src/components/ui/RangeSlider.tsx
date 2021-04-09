import { ChangeEvent } from 'react';
import React, {
  FC, useCallback, useMemo, memo,
} from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import './RangeSlider.scss';

type OwnProps = {
  options?: string[];
  range?: { min: number; max: number; step?: number };
  label?: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
};

const RangeSlider: FC<OwnProps> = ({
  options,
  range,
  label,
  value,
  disabled,
  onChange,
}) => {
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
    } else if (range) {
      const possibleValuesLength = (range.max - range.min) / (range.step || 1);
      return ((value - range.min) / possibleValuesLength) * 100;
    }
    return 0;
  }, [value, options, range]);

  const [min, max, step] = useMemo(() => {
    if (options) {
      return [0, options.length - 1, 1];
    } else if (range) {
      return [range.min, range.max, range.step || 1];
    }

    return [0, 0, 0];
  }, [range, options]);

  return (
    <div className={className}>
      {label && (
        <div className="slider-top-row">
          <span className="label">{label}</span>
          {range && (
            <span className="value">{value}</span>
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
