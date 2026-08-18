import { useEffect } from '../../lib/teact/teact';

import { formatCountdown } from '../../util/dates/oldDateFormat';
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
  mode?: 'clock' | 'countdown' | 'rounded';
  shouldShowZeroOnEnd?: boolean;
  onEnd?: NoneToVoidFunction;
};

const DAY_IN_SECONDS = 24 * 60 * 60;
const UPDATE_FREQUENCY = 500; // Sometimes second gets skipped if using 1000
const SECOND_IN_MS = 1000;

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
  const switchToClockDelay = isActive && mode !== 'clock' && !shouldUseClock
    ? ((timeLeft - DAY_IN_SECONDS) * SECOND_IN_MS) + UPDATE_FREQUENCY
    : undefined;
  const nextUpdateDelay = mode === 'rounded' && switchToClockDelay !== undefined
    ? Math.min(
      switchToClockDelay,
      (((timeLeft % DAY_IN_SECONDS) || DAY_IN_SECONDS) * SECOND_IN_MS) + UPDATE_FREQUENCY,
    )
    : switchToClockDelay;

  useTimeout(forceUpdate, nextUpdateDelay);
  useInterval(forceUpdate, isActive && shouldUseClock ? UPDATE_FREQUENCY : undefined);

  useEffect(() => {
    if (!isActive) {
      onEnd?.();
    }
  }, [isActive, onEnd]);

  if (!isActive && !shouldShowZeroOnEnd) return undefined;

  if (mode === 'rounded' && !shouldUseClock) {
    return <span className={className}>{formatCountdown(lang, timeLeft)}</span>;
  }

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
