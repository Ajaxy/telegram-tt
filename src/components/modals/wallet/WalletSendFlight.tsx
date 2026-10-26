import { memo, useEffect, useRef, useState } from '../../../lib/teact/teact';

import type StandaloneDiamond from '../../../lib/diamond/standalone';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import {
  AMOUNT_DIAMOND_SIZE, finishSendFlight, getSendFlight, getSendFlightRow, ROW_DIAMOND_SIZE, SEND_DIAMOND_CANVAS_SIZE,
  SEND_DIAMOND_SPIN, SEND_DIAMOND_SWAY,
} from './helpers/sendFlight';

import useDerivedState from '../../../hooks/useDerivedState';
import useLastCallback from '../../../hooks/useLastCallback';

import WalletStandaloneDiamond from './WalletStandaloneDiamond';

import styles from './WalletSendFlight.module.scss';

type OwnProps = {
  canLaunch?: boolean;
  onReadyChange: (isReady: boolean) => void;
};

const TRAVEL_DURATION = 500;
const ROW_SCALE = ROW_DIAMOND_SIZE / AMOUNT_DIAMOND_SIZE;
// Share of the travel by which the diamond spins as the one of the row
const SPIN_SHARE = 0.6;
const ARC_HEIGHT = 44;
// Near the top of the throw the diamond is larger, as if flying closer. The growth lasts this share of the travel.
const APEX_GROWTH = 0.28;
const APEX_GROWTH_SHARE = 0.75;
const FALLBACK = <span />;

// The diamond leaves the amount screen and falls by a parabola into the new row of the history. The row moves along
// with the sliding screen, so it is aimed at where the row stands in every frame.
const WalletSendFlight = ({ canLaunch, onReadyChange }: OwnProps) => {
  const layerRef = useRef<HTMLDivElement>();
  const gemRef = useRef<HTMLDivElement>();
  const diamondRef = useRef<StandaloneDiamond>();
  const flight = useDerivedState(getSendFlight);
  // A paused diamond is not drawn, and a diamond becomes ready only after its first drawn frame. So the diamond waits
  // for that frame before it pauses until the launch.
  const [isReady, setIsReady] = useState(false);

  const handleReadyChange = useLastCallback((isDiamondReady: boolean) => {
    setIsReady(isDiamondReady);
    onReadyChange(isDiamondReady);
  });

  useEffect(() => {
    if (!flight) return undefined;

    const layer = layerRef.current!;
    const gem = gemRef.current!;
    const fromSpeed = flight.diamond.speed;
    let hasAdopted = false;
    let frameId = 0;
    // A row that fails or confirms mid-flight goes away, and the diamond still lands where it stood
    let lastTo: number[] | undefined;

    function tick() {
      const progress = Math.min((performance.now() - flight!.startedAt) / TRAVEL_DURATION, 1);
      const diamond = diamondRef.current;

      if (diamond && !hasAdopted) {
        diamond.adopt(flight!.diamond);
        diamond.setIsPaused(false);
        hasAdopted = true;
      }

      if (diamond) {
        const growth = 1 + APEX_GROWTH * Math.sin(Math.PI * Math.min(1, progress / APEX_GROWTH_SHARE));
        diamond.setScale((1 + (ROW_SCALE - 1) * progress) * growth);
        diamond.speed = fromSpeed + (SEND_DIAMOND_SPIN - fromSpeed) * Math.min(1, progress / SPIN_SHARE);
      }

      requestMeasure(() => {
        const layerRect = layer.getBoundingClientRect();
        const row = getSendFlightRow();
        const rowRect = row?.element.getBoundingClientRect();
        const from = [flight!.x - layerRect.left, flight!.y - layerRect.top];
        const to = rowRect
          ? [rowRect.left + rowRect.width / 2 - layerRect.left, rowRect.top + rowRect.height / 2 - layerRect.top]
          : lastTo ?? from;
        lastTo = to;
        const [x, y] = toss(from, to, progress);

        requestMutation(() => {
          gem.style.transform = `translate(${x - AMOUNT_DIAMOND_SIZE / 2}px, ${y - AMOUNT_DIAMOND_SIZE / 2}px)`;
          gem.style.visibility = 'visible';
        });

        if (progress < 1) return;

        if (row && diamond) row.land(diamond);
        finishSendFlight();
      });

      if (progress < 1) frameId = requestAnimationFrame(tick);
    }

    tick();

    return () => {
      cancelAnimationFrame(frameId);
      requestMutation(() => {
        gem.style.visibility = 'hidden';
      });

      // The modal closed mid-flight, and a flight left over would land in a row of the next opening
      if (getSendFlight() === flight) finishSendFlight();
    };
  }, [flight]);

  return (
    <div ref={layerRef} className={styles.layer}>
      <div ref={gemRef} className={styles.gem}>
        {(canLaunch || flight) && (
          <WalletStandaloneDiamond
            diamondRef={diamondRef}
            size={AMOUNT_DIAMOND_SIZE}
            canvasSize={SEND_DIAMOND_CANVAS_SIZE}
            sway={SEND_DIAMOND_SWAY}
            isPaused={!flight && isReady}
            noPreview
            fallback={FALLBACK}
            onReadyChange={handleReadyChange}
          />
        )}
      </div>
    </div>
  );
};

// Rises `ARC_HEIGHT` above the start, or above the target when it is higher, and falls exactly into the target
function toss(from: number[], to: number[], progress: number) {
  const drop = to[1] - from[1];
  const rise = ARC_HEIGHT + Math.max(0, -drop);
  const b = -2 * rise - 2 * Math.sqrt(rise * rise + rise * drop);
  const c = drop - b;

  return [from[0] + (to[0] - from[0]) * progress, from[1] + b * progress + c * progress * progress];
}

export default memo(WalletSendFlight);
