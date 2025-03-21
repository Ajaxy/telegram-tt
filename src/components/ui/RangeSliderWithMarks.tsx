import type { ChangeEvent } from 'react';
import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useLayoutEffect, useMemo, useRef,
} from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import styles from './RangeSliderWithMarks.module.scss';

export type OwnProps = {
  marks: number[];
  onChange: (value: number) => void;
  rangeCount: number;
};

const RangeSliderWithMarks: FC<OwnProps> = ({ marks, onChange, rangeCount }) => {
  // eslint-disable-next-line no-null/no-null
  const sliderRef = useRef<HTMLInputElement | null>(null);

  const rangeCountIndex = useMemo(() => marks.indexOf(rangeCount), [marks, rangeCount]);

  const rangeValue = useMemo(() => {
    return marks.indexOf(rangeCount).toString();
  }, [marks, rangeCount]);

  useLayoutEffect(() => {
    if (sliderRef.current) {
      const fillPercentage = (rangeCountIndex / (marks.length - 1)) * 100;
      const thumbOffset = fillPercentage / 2;
      sliderRef.current.style.setProperty('--fill-percentage', `${fillPercentage}%`);
      sliderRef.current.style.setProperty('--thumb-offset', `${thumbOffset}%`);
    }
  }, [rangeCountIndex, marks]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(event.target.value, 10);
    const newValue = marks[index];
    onChange(newValue);
  };

  return (
    <div className={styles.dotWrapper}>
      <form>
        <div className={styles.sliderContainer}>
          <div className={styles.tickMarks}>
            {marks.map((mark, index) => {
              const isFilled = index <= rangeCountIndex;
              return (
                <div
                  key={mark}
                  className={buildClassName(
                    styles.tick,
                    isFilled ? styles.filled : styles.tickUnfilled,
                  )}
                />
              );
            })}
          </div>
          <div className={styles.marksContainer}>
            {marks.map((mark) => (
              <div
                key={mark}
                className={buildClassName(styles.mark, rangeCount === mark && styles.active)}
              >
                {mark}
              </div>
            ))}
          </div>
          <input
            ref={sliderRef}
            type="range"
            className={styles.slider}
            min="0"
            max={marks.length - 1}
            value={rangeValue}
            onChange={handleChange}
            step="1"
          />
        </div>
      </form>
    </div>
  );
};

export default memo(RangeSliderWithMarks);
