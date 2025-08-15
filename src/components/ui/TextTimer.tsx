import { type FC, memo, useEffect } from '../../lib/teact/teact';

import { formatMediaDuration } from '../../util/dates/dateFormat';
import { getServerTime } from '../../util/serverTime';

import useInterval from '../../hooks/schedulers/useInterval';
import useForceUpdate from '../../hooks/useForceUpdate';
import useLang from '../../hooks/useLang';
import useOldLang from '../../hooks/useOldLang';

import AnimatedCounter from '../common/AnimatedCounter';

type OwnProps = {
  langKey: string;
  endsAt: number;
  onEnd?: NoneToVoidFunction;
};

const UPDATE_FREQUENCY = 500; // Sometimes second gets skipped if using 1000

const TextTimer: FC<OwnProps> = ({ langKey, endsAt, onEnd }) => {
  const lang = useLang();
  const oldLang = useOldLang();
  const forceUpdate = useForceUpdate();

  const serverTime = getServerTime();
  const isActive = serverTime < endsAt;
  useInterval(forceUpdate, isActive ? UPDATE_FREQUENCY : undefined);

  useEffect(() => {
    if (!isActive) {
      onEnd?.();
    }
  }, [isActive, onEnd]);

  if (!isActive) return undefined;

  const timeLeft = endsAt - serverTime;
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

  const isTypedKey = langKey === 'UnlockTimerPublicPostsSearch';

  if (isTypedKey) {
    return (
      <span>
        {lang(langKey, { time: timeCounter }, { withNodes: true })}
      </span>
    );
  }

  return (
    <span>
      {oldLang(langKey, time)}
    </span>
  );
};

export default memo(TextTimer);
