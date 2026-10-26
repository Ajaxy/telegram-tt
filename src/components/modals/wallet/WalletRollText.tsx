import { memo, useLayoutEffect, useRef } from '../../../lib/teact/teact';

import type { RollSegment } from './helpers/roll';

import { startRoll } from './helpers/roll';

type OwnProps = {
  segments: RollSegment[];
  // The roll step, in px
  pitch: number;
  spinKey?: number;
  isSpinUp?: boolean;
  noAnimation?: boolean;
  className?: string;
};

const MAX_BLUR_SHARE = 0.275;

const WalletRollText = ({
  segments, pitch, spinKey, isSpinUp, noAnimation, className,
}: OwnProps) => {
  const textRef = useRef<HTMLSpanElement>();
  const cancelRollRef = useRef<NoneToVoidFunction>();
  const fromSegmentsRef = useRef<RollSegment[]>();
  const spinKeyRef = useRef(spinKey);

  useLayoutEffect(() => {
    const container = textRef.current!;
    const text = segments.map((segment) => segment.text).join('');
    const fromSegments = fromSegmentsRef.current;
    const isSpin = spinKey !== spinKeyRef.current;
    fromSegmentsRef.current = segments;
    spinKeyRef.current = spinKey;
    cancelRollRef.current?.();
    cancelRollRef.current = undefined;

    if (!isSpin || noAnimation || !fromSegments) {
      container.textContent = text;
      return;
    }

    cancelRollRef.current = startRoll(container, fromSegments, segments, {
      isUp: Boolean(isSpinUp),
      pitch,
      maxBlur: pitch * MAX_BLUR_SHARE,
      onEnd() {
        cancelRollRef.current = undefined;
        container.textContent = text;
      },
    });
  }, [segments, spinKey, isSpinUp, noAnimation, pitch]);

  return <span ref={textRef} className={className} aria-hidden />;
};

export default memo(WalletRollText);
