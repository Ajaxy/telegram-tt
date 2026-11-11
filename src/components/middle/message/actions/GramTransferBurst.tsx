import { memo, useEffect, useRef } from '../../../../lib/teact/teact';

import type StandaloneDiamond from '../../../../lib/diamond/standalone';

import { STAR_BURST_DURATION } from '../../../../lib/diamond/stars';
import { requestMutation } from '../../../../lib/fasterdom/fasterdom';

import styles from './GramTransferBurst.module.scss';

type OwnProps = {
  // CSS pixels of the diamond the stars fly out of
  size: number;
  onEnd: NoneToVoidFunction;
};

// As the iOS card, which draws the stars of a completed transfer on a 240pt square around its diamond
const CANVAS_SIZE = 240;
const BURST_SIZE = 0.8;
const SECOND_BURST_DELAY = 200;
const END_DELAY = SECOND_BURST_DELAY + STAR_BURST_DURATION * 1000;

// Two salutes fly out from behind the diamond of a confirmed transfer and spread over the card
const GramTransferBurst = ({ size, onEnd }: OwnProps) => {
  const canvasRef = useRef<HTMLCanvasElement>();

  useEffect(() => {
    let diamond: StandaloneDiamond | undefined;
    let isCancelled = false;
    let burstTimeout: number | undefined;
    let endTimeout: number | undefined;

    import('../../../../lib/diamond/standalone').then(({ default: StandaloneDiamondClass }) => {
      // The diamond sizes its canvas
      requestMutation(() => {
        if (isCancelled) return;

        diamond = new StandaloneDiamondClass(canvasRef.current!, {
          canvasSize: CANVAS_SIZE, size, burstSize: BURST_SIZE, areStarsLight: true, onFallback: onEnd,
        });
        diamond.isStoneHidden = true;
        diamond.burst();
        burstTimeout = window.setTimeout(() => diamond!.burst(), SECOND_BURST_DELAY);
        endTimeout = window.setTimeout(onEnd, END_DELAY);
      });
    }, onEnd);

    return () => {
      isCancelled = true;
      window.clearTimeout(burstTimeout);
      window.clearTimeout(endTimeout);
      diamond?.destroy();
    };
  }, [size, onEnd]);

  const offset = (size - CANVAS_SIZE) / 2;

  return (
    <canvas
      ref={canvasRef}
      className={styles.root}
      style={`width: ${CANVAS_SIZE}px; height: ${CANVAS_SIZE}px; left: ${offset}px; top: ${offset}px`}
    />
  );
};

export default memo(GramTransferBurst);
