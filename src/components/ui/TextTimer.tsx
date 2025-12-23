import { useEffect } from '../../lib/teact/teact';

import { formatMediaDuration } from '../../util/dates/dateFormat';
import { getServerTime } from '../../util/serverTime';

import useInterval from '../../hooks/schedulers/useInterval';
import useForceUpdate from '../../hooks/useForceUpdate';

import AnimatedCounter from '../common/AnimatedCounter';

type OwnProps = {
  endsAt: number;
  shouldShowZeroOnEnd?: boolean;
  onEnd?: NoneToVoidFunction;
};

const UPDATE_FREQUENCY = 500; // Sometimes second gets skipped if using 1000

const TextTimer = ({ endsAt, shouldShowZeroOnEnd, onEnd }: OwnProps) => {
  const forceUpdate = useForceUpdate();

  const serverTime = getServerTime();
  const isActive = serverTime < endsAt;
  useInterval(forceUpdate, isActive ? UPDATE_FREQUENCY : undefined);

  useEffect(() => {
    if (!isActive) {
      onEnd?.();
    }
  }, [isActive, onEnd]);

  if (!isActive && !shouldShowZeroOnEnd) return undefined;

  const timeLeft = Math.max(0, endsAt - serverTime);
  const time = formatMediaDuration(timeLeft);

  const timeParts = time.split(':');
  const timeCounter = (
    <span style="font-variant-numeric: tabular-nums;">
      {timeParts.map((part, index) => (
        <>
          {index > 0 && ':'}
          <AnimatedCounter key={index} text={part} />
        </>
      ))}
    </span>
  );

  return (
    <span>
      {timeCounter}
    </span>
  );
};

export default TextTimer;
