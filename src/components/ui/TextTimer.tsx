import React, { type FC, memo, useEffect } from '../../lib/teact/teact';

import { getServerTime } from '../../util/serverTime';
import { formatMediaDuration } from '../../util/dateFormat';

import useForceUpdate from '../../hooks/useForceUpdate';
import useLang from '../../hooks/useLang';
import useInterval from '../../hooks/useInterval';

type OwnProps = {
  langKey: string;
  endsAt: number;
  onEnd?: NoneToVoidFunction;
};

const UPDATE_FREQUENCY = 500; // Sometimes second gets skipped if using 1000

const TextTimer: FC<OwnProps> = ({ langKey, endsAt, onEnd }) => {
  const lang = useLang();
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
  const formattedTime = formatMediaDuration(timeLeft);

  return (
    <span>
      {lang(langKey, formattedTime)}
    </span>
  );
};

export default memo(TextTimer);
