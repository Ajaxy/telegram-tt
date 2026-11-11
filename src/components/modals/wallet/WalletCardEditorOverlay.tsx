import type { ElementRef, TeactNode } from '../../../lib/teact/teact';
import { memo, useLayoutEffect, useRef } from '../../../lib/teact/teact';

import type { StickerMotionItem, StickerMotionView } from './useStickerMotion';
import type { StickerFramePose } from './useStickerPointer';

import buildClassName from '../../../util/buildClassName';
import { createStickerCanvas, getIsStickerCurlReady } from './helpers/stickerCanvas';
import { STICKER_LAYER_SIZE } from './useStickerMotion';
import { buildFrameTransform } from './useWalletCardEditor';

import useFlag from '../../../hooks/useFlag';

import Portal from '../../ui/Portal';

import styles from './WalletCardEditorOverlay.module.scss';

type OwnProps = {
  // The wallet is a native modal dialog in the top layer, so the overlay goes inside it
  container?: HTMLElement;
  motionItems: StickerMotionItem[];
  framePose?: StickerFramePose;
  isCarrying?: boolean;
  isFlat?: boolean;
  frameRef: ElementRef<HTMLDivElement>;
  layerRef: ElementRef<HTMLDivElement>;
  // The sticker menu, positioned in the same viewport pixels
  children?: TeactNode;
  onMotionViewChange: (address: string, view?: StickerMotionView) => void;
  onHandlePointerDown: (e: React.PointerEvent) => void;
};

// Draws the moving stickers and the frame of the selected one above the whole screen, in viewport pixels
const WalletCardEditorOverlay = ({
  container, motionItems, framePose, isCarrying, isFlat, frameRef, layerRef, children, onMotionViewChange,
  onHandlePointerDown,
}: OwnProps) => {
  if (!container) return undefined;

  return (
    <Portal containerElement={container}>
      <div ref={layerRef} className={styles.root} style={`--layer-size: ${STICKER_LAYER_SIZE}px`}>
        {/* A list of its own keeps the frame in place, so its element and ref survive a change of the list */}
        <div>
          {motionItems.map((item) => (
            <MovingSticker key={item.address} item={item} isFlat={isFlat} onRegister={onMotionViewChange} />
          ))}
        </div>
        {framePose && !isCarrying && (
          <div
            ref={frameRef}
            className={styles.frame}
            style={`transform: ${buildFrameTransform(framePose)}; --side: ${framePose.side}px`}
          >
            <div className={buildClassName(styles.handle, styles.handleLeft)} onPointerDown={onHandlePointerDown} />
            <div className={buildClassName(styles.handle, styles.handleRight)} onPointerDown={onHandlePointerDown} />
          </div>
        )}
        <div className={styles.menu}>{children}</div>
      </div>
    </Portal>
  );
};

// The canvas lives as long as the sticker moves, and the motion draws it each frame
const MovingSticker = memo(({ item, isFlat, onRegister }: {
  item: StickerMotionItem;
  isFlat?: boolean;
  onRegister: (address: string, view?: StickerMotionView) => void;
}) => {
  const clipRef = useRef<HTMLDivElement>();
  const elementRef = useRef<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>();
  const [isGpuLost, markGpuLost] = useFlag();
  const { address, texture } = item;
  const isCurl = !isFlat && !isGpuLost && getIsStickerCurlReady();

  useLayoutEffect(() => {
    const canvas = createStickerCanvas(canvasRef.current!, texture, !isCurl, markGpuLost);
    onRegister(address, { clip: clipRef.current!, element: elementRef.current!, canvas });

    return () => {
      onRegister(address);
      canvas.destroy();
    };
  }, [address, texture, isCurl, onRegister]);

  return (
    <div ref={clipRef} className={styles.clip}>
      <div ref={elementRef} className={styles.sticker}>
        {/* A canvas bound to the GPU cannot draw in 2D, so each mode takes its own */}
        <canvas key={isCurl ? 'curl' : 'flat'} ref={canvasRef} className={styles.canvas} />
      </div>
    </div>
  );
});

export default WalletCardEditorOverlay;
