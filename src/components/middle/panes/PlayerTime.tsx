import { memo, useLayoutEffect, useRef } from '../../../lib/teact/teact';

import type { Signal } from '../../../util/signals';

import { formatMediaDuration } from '../../../util/dates/duration';
import { clamp } from '../../../util/math';

type OwnProps = {
  duration: number;
  className?: string;
  getProgress: Signal<number>;
};

const PlayerTime = ({ duration, className, getProgress }: OwnProps) => {
  const ref = useRef<HTMLSpanElement>();

  useLayoutEffect(() => {
    const progress = clamp(getProgress(), 0, 1);
    const text = formatMediaDuration(duration * progress, duration);
    const element = ref.current!;
    if (element.textContent !== text) element.textContent = text;
  }, [duration, getProgress]);

  return <span className={className} ref={ref} />;
};

export default memo(PlayerTime);
