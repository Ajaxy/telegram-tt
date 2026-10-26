import { memo, useEffect, useRef } from '../../../lib/teact/teact';

import { getIsDiamond3dDegraded } from '../../../lib/diamond/performance';
import { selectShouldLoopStickers } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { LOCAL_TGS_PREVIEW_URLS } from '../../common/helpers/animatedAssets';

import useSelector from '../../../hooks/data/useSelector';
import useDerivedState from '../../../hooks/useDerivedState';
import useFlag from '../../../hooks/useFlag';

import styles from './WalletSpinningDiamond.module.scss';

type OwnProps = {
  size: number;
  className?: string;
};

// The diamond is small, so a denser frame would cost GPU time without a visible difference
const MAX_PIXEL_RATIO = 2;

const WalletSpinningDiamond = ({ size, className }: OwnProps) => {
  const canvasRef = useRef<HTMLCanvasElement>();
  const shouldLoop = useSelector(selectShouldLoopStickers);
  const isDegraded = useDerivedState(getIsDiamond3dDegraded);
  const [isReady, markReady, unmarkReady] = useFlag();
  const [isFailed, markFailed] = useFlag();
  const shouldAnimate = shouldLoop && !isDegraded && !isFailed;

  useEffect(() => {
    if (!shouldAnimate) return undefined;

    const canvas = canvasRef.current!;
    let unsubscribe: NoneToVoidFunction | undefined;
    let isCancelled = false;

    // The 3D scene and its shaders are loaded only once a diamond mounts
    import('../../../lib/diamond/icon').then((icon) => {
      if (isCancelled) return;

      unsubscribe = icon.subscribeDiamondIcon(canvas, markReady, markFailed);
      icon.setDiamondIconSpin(canvas, true);
    }, markFailed);

    return () => {
      isCancelled = true;
      unsubscribe?.();
      unmarkReady();
    };
  }, [shouldAnimate]);

  const pixelSize = Math.round(size * Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));

  return (
    <div className={buildClassName(styles.root, className)} style={`width: ${size}px; height: ${size}px`}>
      {/* The 3D can be given up after its first frame, and the preview takes its place again */}
      <img
        src={LOCAL_TGS_PREVIEW_URLS.Gram3d}
        alt=""
        draggable={false}
        className={buildClassName(styles.preview, isReady && shouldAnimate && styles.previewHidden)}
      />
      {shouldAnimate && (
        <canvas
          ref={canvasRef}
          className={buildClassName(styles.canvas, isReady && styles.ready)}
          width={pixelSize}
          height={pixelSize}
          style={`width: ${size}px; height: ${size}px`}
        />
      )}
    </div>
  );
};

export default memo(WalletSpinningDiamond);
