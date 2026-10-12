import { memo, useEffect, useRef } from '../../../../lib/teact/teact';

import { getIsDiamond3dDegraded } from '../../../../lib/diamond/performance';
import buildClassName from '../../../../util/buildClassName';
import { LOCAL_TGS_PREVIEW_URLS, LOCAL_TGS_URLS } from '../../../common/helpers/animatedAssets';

import useDerivedState from '../../../../hooks/useDerivedState';
import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';

import AnimatedIconWithPreview from '../../../common/AnimatedIconWithPreview';

import styles from './GramTransferDiamond.module.scss';

type DiamondIcon = typeof import('../../../../lib/diamond/icon');

type OwnProps = {
  size: number;
  className?: string;
  // The Lottie coin loops only while the pointer is over the card
  isHovered?: boolean;
  shouldLoopStickers?: boolean;
};

// A denser frame would cost GPU time without a visible difference at this size
const MAX_PIXEL_RATIO = 2;
const IS_REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const GramTransferDiamond = ({
  size, className, isHovered, shouldLoopStickers,
}: OwnProps) => {
  const canvasRef = useRef<HTMLCanvasElement>();
  const iconRef = useRef<DiamondIcon>();
  const lastPointRef = useRef<{ x: number; y: number }>();
  const isDegraded = useDerivedState(getIsDiamond3dDegraded);
  const [isReady, markReady] = useFlag();
  const [isFailed, markFailed] = useFlag();

  // `isHeld` outlives the press until the diamond has returned to the turn of the others
  const [isZoomed, markZoomed, unmarkZoomed] = useFlag();
  const [isHeld, markHeld, unmarkHeld] = useFlag();
  const is3d = shouldLoopStickers && !isDegraded && !isFailed;
  const shouldAnimate = is3d && !IS_REDUCED_MOTION;

  useEffect(() => {
    if (!shouldAnimate) return undefined;

    const canvas = canvasRef.current!;

    // Only a native listener stops the touch before the message's long-press handler sees it
    canvas.addEventListener('touchstart', stopPropagation, { passive: true });

    let unsubscribe: NoneToVoidFunction | undefined;
    let isCancelled = false;

    // The WebGL scene and its shaders are loaded only for a card that draws the diamond
    import('../../../../lib/diamond/icon').then((icon) => {
      if (isCancelled) return;

      iconRef.current = icon;
      unsubscribe = icon.subscribeDiamondIcon(canvas, markReady, markFailed);
    }, markFailed);

    return () => {
      isCancelled = true;
      canvas.removeEventListener('touchstart', stopPropagation);
      unsubscribe?.();
    };
  }, [shouldAnimate]);

  const handlePointerDown = useLastCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || !iconRef.current?.holdDiamondIcon(e.currentTarget)) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    lastPointRef.current = { x: e.clientX, y: e.clientY };
    markZoomed();
    markHeld();
  });

  const handlePointerMove = useLastCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const lastPoint = lastPointRef.current;
    if (!lastPoint) return;

    // On macOS, Ctrl+click opens a context menu that takes the button release, so `pointerup` never comes
    if (!e.buttons) {
      handlePointerUp();
      return;
    }

    iconRef.current!.turnDiamondIcon(e.currentTarget, e.clientX - lastPoint.x, e.clientY - lastPoint.y);
    lastPointRef.current = { x: e.clientX, y: e.clientY };
  });

  const handlePointerUp = useLastCallback(() => {
    if (!lastPointRef.current) return;

    lastPointRef.current = undefined;
    unmarkZoomed();
    iconRef.current!.releaseDiamondIcon(canvasRef.current!, unmarkHeld);
  });

  // Pressing zooms the diamond, so a click on it does not open the transfer
  const handleClick = useLastCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
  });

  // Mobile browsers report a long press as a context menu request, which must not open the message menu
  const handleContextMenu = useLastCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!lastPointRef.current) return;

    e.preventDefault();
    e.stopPropagation();
  });

  if (!is3d) {
    return (
      <AnimatedIconWithPreview
        tgsUrl={LOCAL_TGS_URLS.Gram}
        previewUrl={LOCAL_TGS_PREVIEW_URLS.Gram}
        size={size}
        className={className}
        noLoop={!isHovered}
        nonInteractive
      />
    );
  }

  const pixelSize = Math.round(size * Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));

  // The still stands in until the first frame arrives
  return (
    <div
      className={buildClassName(styles.root, isHeld && styles.held, className)}
      style={`width: ${size}px; height: ${size}px`}
    >
      <div className={buildClassName(styles.zoom, isZoomed && styles.zoomed)}>
        <img
          src={LOCAL_TGS_PREVIEW_URLS.Gram3d}
          alt=""
          draggable={false}
          className={buildClassName(styles.preview, isReady && styles.previewHidden)}
        />
        {shouldAnimate && (
          <canvas
            ref={canvasRef}
            className={buildClassName(styles.canvas, isReady && styles.ready)}
            width={pixelSize}
            height={pixelSize}
            style={`width: ${size}px; height: ${size}px`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
          />
        )}
      </div>
    </div>
  );
};

function stopPropagation(e: Event) {
  e.stopPropagation();
}

export default memo(GramTransferDiamond);
