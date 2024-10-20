import React, { memo, useEffect, useState } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import { formatCountdownShort } from '../../util/dates/dateFormat';

import useInterval from '../../hooks/schedulers/useInterval';
import useOldLang from '../../hooks/useOldLang';

import AnimatedCounter from '../common/AnimatedCounter';

import styles from './RoundTimer.module.scss';

type OwnProps = {
  duration: number;
  className?: string;
  onEnd?: NoneToVoidFunction;
};

const UPDATE_FREQUENCY = 1000;
const TIMER_RADIUS = 14;

const RoundTimer = ({ duration, className, onEnd }: OwnProps) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const lang = useOldLang();

  useInterval(
    () => setTimeLeft((prev) => prev - 1),
    timeLeft > 0 ? UPDATE_FREQUENCY : undefined,
  );

  useEffect(() => {
    if (timeLeft <= 0) {
      onEnd?.();
    }
  }, [timeLeft, onEnd]);

  useEffect(() => {
    setTimeLeft(duration);
  }, [duration]);

  return (
    <div className={buildClassName(styles.root, className)}>
      <svg className={styles.svg} width="32px" height="32px">
        <circle
          cx="16"
          cy="16"
          r={TIMER_RADIUS}
          transform="rotate(-90, 16, 16)"
          pathLength="100"
          stroke-dasharray="100"
          stroke-dashoffset={100 - ((timeLeft - 1) / duration) * 100} // Show it one step further due to animation
          className={styles.circle}
        />
      </svg>
      <AnimatedCounter className={styles.text} text={formatCountdownShort(lang, timeLeft * 1000)} />
    </div>
  );
};

export default memo(RoundTimer);
