import { memo, useEffect, useRef } from '../../../lib/teact/teact';

import { selectShouldLoopStickers } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { LOCAL_TGS_PREVIEW_URLS } from '../../common/helpers/animatedAssets';

import useSelector from '../../../hooks/data/useSelector';
import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';

import styles from './WalletCardDiamond.module.scss';

type OwnProps = {
  className?: string;
};

// Covers the canvas at its grown size on a 3x screen
const CANVAS_SIZE = 360;
// Seconds per turn, as on the iOS card
const TURN_DURATION = 26;
// About 30 frames per second, as for the other small diamonds
const REST_FRAME_INTERVAL = 30;

const WalletCardDiamond = ({ className }: OwnProps) => {
  const canvasRef = useRef<HTMLCanvasElement>();
  const shouldLoop = useSelector(selectShouldLoopStickers);
  const [isReady, markReady] = useFlag();
  const [isFailed, markFailed] = useFlag();
  // `isRaised` outlives the press until the diamond has shrunk back, so the amount line does not clip it meanwhile
  const [isGrown, markGrown, unmarkGrown] = useFlag();
  const [isRaised, markRaised, unmarkRaised] = useFlag();
  const is3d = shouldLoop && !isFailed;

  useEffect(() => {
    if (!is3d) return undefined;

    const canvas = canvasRef.current!;
    let teardown: NoneToVoidFunction | undefined;
    let isCancelled = false;

    import('../../../lib/diamond').then(({ setupDiamond }) => {
      if (isCancelled) return;

      teardown = setupDiamond(canvas, markReady, markFailed, {
        palette: 'white',
        turnDuration: TURN_DURATION,
        restFrameInterval: REST_FRAME_INTERVAL,
      });
    }, markFailed);

    return () => {
      isCancelled = true;
      teardown?.();
    };
  }, [is3d]);

  const handlePointerDown = useLastCallback((e: PointerEvent) => {
    // The card tilts under the pointer, which would fight the diamond in the hand
    e.stopPropagation();
    if (e.button !== 0) return;

    markGrown();
    markRaised();
  });

  const handlePointerMove = useLastCallback((e: PointerEvent) => {
    e.stopPropagation();

    // On macOS, Ctrl+click opens a context menu that takes the button release, so `pointerup` never comes
    if (isGrown && !e.buttons) unmarkGrown();
  });

  // Mobile browsers report a long press as a context menu request
  const handleContextMenu = useLastCallback((e: MouseEvent) => {
    if (isGrown) e.preventDefault();
  });

  const handleTransitionEnd = useLastCallback(() => {
    if (!isGrown) unmarkRaised();
  });

  // Native listeners, since the card follows the pointer with native ones that a delegated handler comes too late for
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', unmarkGrown);
    canvas.addEventListener('pointercancel', unmarkGrown);
    canvas.addEventListener('lostpointercapture', unmarkGrown);
    canvas.addEventListener('contextmenu', handleContextMenu);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', unmarkGrown);
      canvas.removeEventListener('pointercancel', unmarkGrown);
      canvas.removeEventListener('lostpointercapture', unmarkGrown);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [is3d, handlePointerDown, handlePointerMove, handleContextMenu, unmarkGrown]);

  return (
    <div
      className={buildClassName(styles.root, isRaised && styles.raised, className)}
      data-raised={isRaised || undefined}
    >
      {/* The first frame of the diamond stands in until the scene draws, and for good where 3D is off */}
      <img
        src={LOCAL_TGS_PREVIEW_URLS.WhiteDiamond3d}
        alt=""
        draggable={false}
        className={buildClassName(styles.preview, isReady && is3d && styles.previewHidden)}
      />
      {is3d && (
        <canvas
          ref={canvasRef}
          className={buildClassName(styles.canvas, isReady && styles.ready, isGrown && styles.grown)}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          onTransitionEnd={handleTransitionEnd}
        />
      )}
    </div>
  );
};

export default memo(WalletCardDiamond);
