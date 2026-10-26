import type { ElementRef, TeactNode } from '../../../lib/teact/teact';
import { memo, useEffect, useRef } from '../../../lib/teact/teact';

import type StandaloneDiamond from '../../../lib/diamond/standalone';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { selectShouldLoopStickers } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { LOCAL_TGS_PREVIEW_URLS } from '../../common/helpers/animatedAssets';

import useSelector from '../../../hooks/data/useSelector';
import useFlag from '../../../hooks/useFlag';
import { useStateRef } from '../../../hooks/useStateRef';

import GramTransferDiamond from '../../middle/message/actions/GramTransferDiamond';

import styles from './WalletStandaloneDiamond.module.scss';

type OwnProps = {
  diamondRef: ElementRef<StandaloneDiamond>;
  // CSS pixels of the diamond frame and of the canvas around it, which leaves room to grow and to salute
  size: number;
  canvasSize: number;
  speed?: number;
  sway?: number;
  burstSize?: number;
  isPaused?: boolean;
  noPreview?: boolean;
  // Shown instead of the diamond when it cannot be drawn in 3D
  fallback?: TeactNode;
  // Reports whether the 3D diamond is on screen and so can be turned
  onReadyChange?: (isReady: boolean) => void;
};

const WalletStandaloneDiamond = ({
  diamondRef, size, canvasSize, speed, sway, burstSize, isPaused, noPreview, fallback, onReadyChange,
}: OwnProps) => {
  const shouldLoopStickers = useSelector(selectShouldLoopStickers);
  const canvasRef = useRef<HTMLCanvasElement>();
  const [isReady, markReady, unmarkReady] = useFlag();
  const [isFailed, markFailed] = useFlag();
  const is3d = shouldLoopStickers && !isFailed;
  // The diamond starts with these and then is driven through `diamondRef`
  const optionsRef = useStateRef({
    speed, sway, burstSize, isPaused,
  });

  useEffect(() => {
    if (!is3d) return undefined;

    let diamond: StandaloneDiamond | undefined;
    let isCancelled = false;

    // The 3D scene and its shaders are loaded only once a diamond mounts
    import('../../../lib/diamond/standalone').then(({ default: StandaloneDiamondClass }) => {
      // The diamond sizes its canvas
      requestMutation(() => {
        if (isCancelled) return;

        diamond = new StandaloneDiamondClass(canvasRef.current!, {
          ...optionsRef.current, canvasSize, size, onReady: markReady, onFallback: markFailed,
        });
        diamond.setIsPaused(Boolean(optionsRef.current.isPaused));
        diamondRef.current = diamond;
      });
    }, markFailed);

    return () => {
      isCancelled = true;
      diamond?.destroy();
      if (diamondRef.current === diamond) diamondRef.current = undefined;
      unmarkReady();
    };
  }, [is3d, canvasSize, size, diamondRef, optionsRef]);

  useEffect(() => {
    diamondRef.current?.setIsPaused(Boolean(isPaused));
  }, [isPaused, diamondRef]);

  const isShown = is3d && isReady;
  useEffect(() => {
    onReadyChange?.(isShown);
  }, [isShown, onReadyChange]);

  if (!is3d) {
    return fallback ?? (
      <GramTransferDiamond size={size} shouldLoopStickers={shouldLoopStickers} />
    );
  }

  const offset = (size - canvasSize) / 2;

  return (
    <span className={styles.root} style={`width: ${size}px; height: ${size}px`}>
      {!noPreview && (
        <img
          src={LOCAL_TGS_PREVIEW_URLS.Gram3d}
          alt=""
          draggable={false}
          className={buildClassName(styles.preview, isReady && styles.previewHidden)}
        />
      )}
      <canvas
        ref={canvasRef}
        className={buildClassName(styles.canvas, (isReady || noPreview) && styles.ready)}
        style={`width: ${canvasSize}px; height: ${canvasSize}px; left: ${offset}px; top: ${offset}px`}
      />
    </span>
  );
};

export default memo(WalletStandaloneDiamond);
