import { useEffect } from '../../lib/teact/teact';

import { formatClockDuration, formatCountdownDateTime, secondsToDate } from '../../util/localization/dateFormat';
import { getServerTime } from '../../util/serverTime';

import useInterval from '../../hooks/schedulers/useInterval';
import useTimeout from '../../hooks/schedulers/useTimeout';
import useForceUpdate from '../../hooks/useForceUpdate';
import useLang from '../../hooks/useLang';

import AnimatedCounter from '../common/AnimatedCounter';

type OwnProps = {
  className?: string;
  endsAt: number;
  mode?: 'clock' | 'countdown';
  shouldShowZeroOnEnd?: boolean;
  onEnd?: NoneToVoidFunction;
};

const DAY_IN_SECONDS = 24 * 60 * 60;
const UPDATE_FREQUENCY = 500; // Sometimes second gets skipped if using 1000

const TextTimer = ({
  className,
  endsAt,
  mode = 'clock',
  shouldShowZeroOnEnd,
  onEnd,
}: OwnProps) => {
  const forceUpdate = useForceUpdate();
  const lang = useLang();

  const serverTime = getServerTime();
  const isActive = serverTime < endsAt;
  const timeLeft = Math.max(0, endsAt - serverTime);
  const shouldUseClock = mode === 'clock' || timeLeft < DAY_IN_SECONDS;
  const switchToClockDelay = isActive && mode === 'countdown' && !shouldUseClock
    ? ((timeLeft - DAY_IN_SECONDS) * 1000) + UPDATE_FREQUENCY
    : undefined;

  useTimeout(forceUpdate, switchToClockDelay);
  useInterval(forceUpdate, isActive && shouldUseClock ? UPDATE_FREQUENCY : undefined);

  useEffect(() => {
    if (!isActive) {
      onEnd?.();
    }
  }, [isActive, onEnd]);

  if (!isActive && !shouldShowZeroOnEnd) return undefined;

  if (mode === 'countdown' && !shouldUseClock) {
    return (
      <span className={className}>
        {formatCountdownDateTime(lang, secondsToDate(endsAt), {
          anchorDate: secondsToDate(serverTime),
        })}
      </span>
    );
  }

  const time = formatClockDuration(timeLeft);

  const timeParts = time.split(':');
  const clockNode = (
    <>
      {timeParts.map((part, index) => (
        <span key={index}>
          {index > 0 && ':'}
          <AnimatedCounter text={part} />
        </span>
      ))}
    </>
  );

  return (
    <span className={className} style="font-variant-numeric: tabular-nums;">
      {mode === 'countdown'
        ? lang('TimeIn', { time: clockNode }, { withNodes: true })
        : clockNode}
    </span>
  );
};

export default TextTimer;
