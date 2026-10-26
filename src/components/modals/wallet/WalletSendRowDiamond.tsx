import { memo, useEffect, useMemo, useRef } from '../../../lib/teact/teact';

import type StandaloneDiamond from '../../../lib/diamond/standalone';
import type { SendFlightRow } from './helpers/sendFlight';

import buildClassName from '../../../util/buildClassName';
import {
  claimSendFlightRow, releaseSendFlightRow, SEND_DIAMOND_CANVAS_SIZE, SEND_DIAMOND_SPIN, SEND_DIAMOND_SWAY,
} from './helpers/sendFlight';

import useFlag from '../../../hooks/useFlag';

import WalletSpinningDiamond from './WalletSpinningDiamond';
import WalletStandaloneDiamond from './WalletStandaloneDiamond';

import styles from './WalletSendRowDiamond.module.scss';

type OwnProps = {
  size: number;
  isQueued?: boolean;
  className?: string;
  onClaim: NoneToVoidFunction;
  onLand: NoneToVoidFunction;
};

const BURST_SIZE = 0.7;
const LAND_KICK = 7;
const LAND_VIBRATION = 12;
// A flight that has not landed by then, as when its diamond failed to load, leaves the row its own diamond
const LANDING_TIMEOUT = 1500;

// The diamond of the row of a pending transfer, which takes the flying diamond over when it lands
const WalletSendRowDiamond = ({
  size, isQueued, className, onClaim, onLand,
}: OwnProps) => {
  const ref = useRef<HTMLSpanElement>();
  const diamondRef = useRef<StandaloneDiamond>();
  // Only the record of a transfer that has just been queued takes the flying diamond, never another pending one
  const canClaimRef = useRef(isQueued);
  const [isWaiting, markWaiting, unmarkWaiting] = useFlag();

  useEffect(() => {
    let timeout: number | undefined;

    const row: SendFlightRow = {
      element: ref.current!,
      land(flying) {
        const diamond = diamondRef.current;
        if (diamond) {
          diamond.adopt(flying);
          diamond.speed = SEND_DIAMOND_SPIN;
          diamond.kick(LAND_KICK);
        }

        window.clearTimeout(timeout);
        unmarkWaiting();
        navigator.vibrate?.(LAND_VIBRATION);
        onLand();
      },
    };
    const isClaimed = canClaimRef.current && claimSendFlightRow(row);

    if (isClaimed) {
      markWaiting();
      timeout = window.setTimeout(unmarkWaiting, LANDING_TIMEOUT);
      onClaim();
    }

    return () => {
      window.clearTimeout(timeout);
      releaseSendFlightRow(row);
    };
  }, [onClaim, onLand, markWaiting, unmarkWaiting]);

  const fallback = useMemo(() => <WalletSpinningDiamond size={size} />, [size]);

  return (
    <span ref={ref} className={buildClassName(styles.root, isWaiting && styles.waiting, className)}>
      <WalletStandaloneDiamond
        diamondRef={diamondRef}
        size={size}
        canvasSize={SEND_DIAMOND_CANVAS_SIZE}
        speed={SEND_DIAMOND_SPIN}
        sway={SEND_DIAMOND_SWAY}
        burstSize={BURST_SIZE}
        fallback={fallback}
      />
    </span>
  );
};

export default memo(WalletSendRowDiamond);
