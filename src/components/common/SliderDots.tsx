import type { FC } from '../../lib/teact/teact';
import React, { memo, useCallback } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import { IS_TOUCH_ENV } from '../../util/windowEnvironment';

import Button from '../ui/Button';

import styles from './SliderDots.module.scss';

type OwnProps = {
  length: number;
  active: number;
  onSelectSlide: (index: number) => void;
};

const SliderDots: FC<OwnProps> = ({
  length,
  active,
  onSelectSlide,
}) => {
  const startFrom = Math.max(0, Math.min(length - 8, active - 4));
  const isPreLastBatch = startFrom === length - 8 - 1;
  const isLastBatch = startFrom === length - 8;
  const isFirstBatch = startFrom === 0;
  const isPreFirstBatch = startFrom === 1;
  const shownDotsCount = Math.min(length, 8);

  const handleGoForward = useCallback(() => {
    onSelectSlide(active + 1);
  }, [active, onSelectSlide]);

  const handleGoBack = useCallback(() => {
    onSelectSlide(active - 1);
  }, [active, onSelectSlide]);

  const count = Math.min(8, length);

  return (
    <div>
      {!IS_TOUCH_ENV && (
        <Button
          className={buildClassName(styles.arrow, active === 0 && styles.arrowHidden)}
          color="translucent"
          disabled={active === 0}
          round
          onClick={handleGoBack}
        >
          <i className="icon icon-previous" />
        </Button>
      )}
      <div className={styles.root} style={`--start-from: ${startFrom}; --length: ${length}; --count: ${count};`}>
        {Array(length).fill(undefined).map((_, i) => {
          const index = i;
          const isLast = (i === startFrom + shownDotsCount - 1 && !isLastBatch && !isPreLastBatch);
          const isPreLast = (i === startFrom + shownDotsCount - 2 && !isPreLastBatch && !isLastBatch)
            || (i === startFrom + shownDotsCount - 1 && isPreLastBatch);
          const isFirst = (i === startFrom) && !isFirstBatch && !isPreFirstBatch;
          const isPreFirst = ((i === startFrom + 1) && !isFirstBatch && !isPreFirstBatch)
            || (i === startFrom && isPreFirstBatch);
          const isInvisible = i < startFrom || i >= startFrom + shownDotsCount;
          return (
            <div
              onClick={() => onSelectSlide(i)}
              className={buildClassName(
                styles.dot,
                index === active && styles.active,
                (isPreLast || isPreFirst) && styles.medium,
                (isLast || isFirst || isInvisible) && styles.small,
                isInvisible && styles.invisible,
              )}
            />
          );
        })}
      </div>
      {!IS_TOUCH_ENV && (
        <Button
          className={buildClassName(styles.arrow, active === length - 1 && styles.arrowHidden, styles.right)}
          color="translucent"
          round
          disabled={active === length - 1}
          onClick={handleGoForward}
        >
          <i className="icon icon-next" />
        </Button>
      )}
    </div>
  );
};

export default memo(SliderDots);
