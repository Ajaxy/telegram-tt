import { memo, useEffect, useRef } from '../../../lib/teact/teact';

import { selectShouldLoopStickers } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { LOCAL_TGS_PREVIEW_URLS, LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';

import useSelector from '../../../hooks/data/useSelector';
import useFlag from '../../../hooks/useFlag';

import AnimatedIconWithPreview from '../../common/AnimatedIconWithPreview';

import styles from './WalletDiamond.module.scss';

type OwnProps = {
  size: number;
};

const WalletDiamond = ({ size }: OwnProps) => {
  const canvasRef = useRef<HTMLCanvasElement>();
  const shouldLoop = useSelector(selectShouldLoopStickers);
  const [isReady, markReady] = useFlag();
  const [isFailed, markFailed] = useFlag();
  const is3d = shouldLoop && !isFailed;

  useEffect(() => {
    if (!is3d) return undefined;

    const canvas = canvasRef.current!;
    let teardown: NoneToVoidFunction | undefined;
    let isCancelled = false;

    // The WebGL scene and its shaders are loaded only once a diamond is shown
    import('../../../lib/diamond').then(({ setupDiamond }) => {
      if (isCancelled) return;

      teardown = setupDiamond(canvas, markReady, markFailed);
    }, markFailed);

    return () => {
      isCancelled = true;
      teardown?.();
    };
  }, [is3d]);

  if (!is3d) {
    return (
      <AnimatedIconWithPreview
        tgsUrl={LOCAL_TGS_URLS.BlueDiamond}
        previewUrl={LOCAL_TGS_PREVIEW_URLS.BlueDiamond}
        size={size}
      />
    );
  }

  const pixelSize = Math.round(size * (window.devicePixelRatio || 1));

  // Dropping the still at once would leave a blank frame before the canvas fades in
  return (
    <div className={styles.root} style={`width: ${size}px; height: ${size}px`}>
      <img
        src={LOCAL_TGS_PREVIEW_URLS.BlueDiamond3d}
        alt=""
        draggable={false}
        className={buildClassName(styles.preview, isReady && styles.previewHidden)}
      />
      <canvas
        ref={canvasRef}
        className={buildClassName(styles.canvas, isReady && styles.ready)}
        width={pixelSize}
        height={pixelSize}
        style={`width: ${size}px; height: ${size}px`}
      />
    </div>
  );
};

export default memo(WalletDiamond);
