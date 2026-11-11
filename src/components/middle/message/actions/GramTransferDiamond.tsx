import {
  memo, useEffect, useRef, useState,
} from '../../../../lib/teact/teact';

import { drawLensText, MIN_LENS_STRENGTH } from '../../../../lib/diamond/lensText';
import { getIsDiamond3dDegraded } from '../../../../lib/diamond/performance';
import { requestMeasure, requestMutation } from '../../../../lib/fasterdom/fasterdom';
import { animate } from '../../../../util/animation';
import buildClassName from '../../../../util/buildClassName';
import { clamp } from '../../../../util/math';
import { LOCAL_TGS_PREVIEW_URLS, LOCAL_TGS_URLS } from '../../../common/helpers/animatedAssets';
import { getDampedWave, sampleFrames } from '../../../modals/wallet/helpers/motion';

import useDerivedState from '../../../../hooks/useDerivedState';
import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';

import AnimatedIconWithPreview from '../../../common/AnimatedIconWithPreview';
import GramTransferBurst from './GramTransferBurst';

import styles from './GramTransferDiamond.module.scss';

type DiamondIcon = typeof import('../../../../lib/diamond/icon');

type OwnProps = {
  size: number;
  className?: string;
  // The Lottie coin loops only while the pointer is over the card
  isHovered?: boolean;
  shouldLoopStickers?: boolean;
  // A change of the key swells the diamond and salutes, as the iOS card does once a transfer is confirmed
  burstKey?: number;
  getLensText?: () => HTMLElement[];
};

// A denser frame would cost GPU time without a visible difference at this size
const MAX_PIXEL_RATIO = 2;
// See `.zoomed` in the stylesheet
const ZOOMED_SCALE = 3;
// The swell of the iOS card's diamond
const SWELL_DURATION = 900;
const SWELL_FREQUENCY = 1.6;
const SWELL_DECAY = 200;
// The last frame is the resting size, so the diamond does not jump when the swell ends
const SWELL_FRAMES = sampleFrames(SWELL_DURATION, (time, progress) => ({
  scale: String(progress === 1 ? 1 : 1 + getDampedWave(time, SWELL_FREQUENCY, SWELL_DECAY)),
}));

const GramTransferDiamond = ({
  size, className, isHovered, shouldLoopStickers, burstKey, getLensText,
}: OwnProps) => {
  const canvasRef = useRef<HTMLCanvasElement>();
  const zoomRef = useRef<HTMLDivElement>();
  const iconRef = useRef<DiamondIcon>();
  const lastPointRef = useRef<{ x: number; y: number }>();
  const swellRef = useRef<Animation>();
  // The icon keeps the last text it uploaded for the canvas, so the version keeps growing from hold to hold
  const textVersionRef = useRef(0);
  const isDegraded = useDerivedState(getIsDiamond3dDegraded);
  const [isReady, markReady, unmarkReady] = useFlag();
  const [isFailed, markFailed] = useFlag();

  // `isHeld` outlives the press until the diamond has returned to the turn of the others
  const [isZoomed, markZoomed, unmarkZoomed] = useFlag();
  const [isHeld, markHeld, unmarkHeld] = useFlag();
  // A diamond already drawn keeps its last frame when 3D gives up, so the card does not change under the eye
  const is3d = shouldLoopStickers && !isFailed && (!isDegraded || isReady);
  // A frozen diamond cannot turn, so it lets the pointer through to the card like the still
  const isInteractive = isReady && !isDegraded;
  const [shownBurstKey, setShownBurstKey] = useState<number>();
  // A transfer confirmed while the diamond still loads salutes once the diamond is drawn
  const playedBurstKeyRef = useRef<number>();

  useEffect(() => {
    if (!is3d) return undefined;

    const canvas = canvasRef.current!;

    // Only a native listener stops the touch before the message's long-press handler sees it
    canvas.addEventListener('touchstart', stopPropagation, { passive: true });

    let unsubscribe: NoneToVoidFunction | undefined;
    let isCancelled = false;

    // The 3D scene and its shaders are loaded only for a card that draws the diamond
    import('../../../../lib/diamond/icon').then((icon) => {
      if (isCancelled) return;

      iconRef.current = icon;
      unsubscribe = icon.subscribeDiamondIcon(canvas, markReady, markFailed);
    }, markFailed);

    return () => {
      isCancelled = true;
      canvas.removeEventListener('touchstart', stopPropagation);
      unsubscribe?.();
      unmarkReady();
    };
  }, [is3d]);

  useEffect(() => {
    if (!burstKey || !isInteractive || burstKey === playedBurstKeyRef.current) return;

    playedBurstKeyRef.current = burstKey;
    setShownBurstKey(burstKey);

    requestMutation(() => {
      swellRef.current = zoomRef.current?.animate(SWELL_FRAMES, SWELL_DURATION);
    });
  }, [burstKey, isInteractive]);

  const handleBurstEnd = useLastCallback(() => {
    setShownBurstKey(undefined);
  });

  useEffect(() => {
    if (!isHeld || !isInteractive || !getLensText) return undefined;

    const canvas = canvasRef.current!;
    const icon = iconRef.current!;
    const text = document.createElement('canvas');
    let isRunning = true;

    animate(() => {
      if (!isRunning) return false;

      const rect = canvas.getBoundingClientRect();
      // The lens comes in as the diamond zooms in and fades as it shrinks back
      const strength = clamp((rect.width / size - 1) / (ZOOMED_SCALE - 1), 0, 1);

      if (strength <= MIN_LENS_STRENGTH) {
        icon.setDiamondIconLens(canvas, undefined);

        return true;
      }

      const isChanged = drawLensText(text, canvas.width, getLensText(), {
        left: rect.left, top: rect.top, scale: canvas.width / rect.width,
      });
      if (isChanged) textVersionRef.current++;

      icon.setDiamondIconLens(canvas, {
        text, textVersion: textVersionRef.current, textShift: 0, strength,
      });

      return true;
    }, requestMeasure);

    return () => {
      isRunning = false;
      icon.setDiamondIconLens(canvas, undefined);
    };
  }, [isHeld, isInteractive, size, getLensText]);

  const handlePointerDown = useLastCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || !iconRef.current?.holdDiamondIcon(e.currentTarget)) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    lastPointRef.current = { x: e.clientX, y: e.clientY };
    // The swell scales the same element and would hold the zoom back
    swellRef.current?.cancel();
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

  // With looped stickers off, the coin stays still like the 3D diamond, which is off then too
  if (!is3d) {
    return (
      <AnimatedIconWithPreview
        tgsUrl={LOCAL_TGS_URLS.Gram}
        previewUrl={LOCAL_TGS_PREVIEW_URLS.Gram}
        size={size}
        className={className}
        play={Boolean(shouldLoopStickers)}
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
      {shownBurstKey !== undefined && (
        <GramTransferBurst key={shownBurstKey} size={size} onEnd={handleBurstEnd} />
      )}
      <div ref={zoomRef} className={buildClassName(styles.zoom, isZoomed && styles.zoomed)}>
        <img
          src={LOCAL_TGS_PREVIEW_URLS.Gram3d}
          alt=""
          draggable={false}
          className={buildClassName(styles.preview, isReady && styles.previewHidden)}
        />
        {is3d && (
          <canvas
            ref={canvasRef}
            className={buildClassName(styles.canvas, isReady && styles.ready, isInteractive && styles.interactive)}
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
