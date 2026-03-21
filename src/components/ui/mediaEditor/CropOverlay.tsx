import { memo } from '@teact';

import type { CropState, ResizeHandle } from './hooks/useCropper';

import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';

import styles from './MediaEditor.module.scss';

type OwnProps = {
  cropState: CropState;
  displaySize: { width: number; height: number };
  scale: number;
  isFadingOut: boolean;
  onCropperDragStart: (e: React.MouseEvent | React.TouchEvent) => void;
  onCornerResizeStart: (e: React.MouseEvent | React.TouchEvent, handle: ResizeHandle) => void;
};

const CORNERS: ResizeHandle[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

function CropOverlay({
  cropState,
  displaySize,
  scale,
  isFadingOut,
  onCropperDragStart,
  onCornerResizeStart,
}: OwnProps) {
  const { cropperX, cropperY, cropperWidth, cropperHeight } = cropState;

  const frameX = cropperX * scale;
  const frameY = cropperY * scale;
  const frameWidth = cropperWidth * scale;
  const frameHeight = cropperHeight * scale;

  if (frameWidth === 0 || frameHeight === 0) return undefined;

  return (
    <div
      className={buildClassName(styles.cropWrapper, isFadingOut && styles.fadingOut)}
      style={`width: ${displaySize.width}px; height: ${displaySize.height}px`}
    >
      <div
        className={styles.cropDarkOverlay}
        style={`clip-path: polygon(
          0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
          ${frameX}px ${frameY}px,
          ${frameX}px ${frameY + frameHeight}px,
          ${frameX + frameWidth}px ${frameY + frameHeight}px,
          ${frameX + frameWidth}px ${frameY}px,
          ${frameX}px ${frameY}px
        )`}
      />
      <div
        className={styles.cropRegion}
        style={buildStyle(
          `left: ${frameX}px`,
          `top: ${frameY}px`,
          `width: ${frameWidth}px`,
          `height: ${frameHeight}px`,
        )}
        onMouseDown={onCropperDragStart}
        onTouchStart={onCropperDragStart}
      >
        <div className={styles.cropGrid} />
      </div>
      {CORNERS.map((corner) => {
        const isTop = corner === 'topLeft' || corner === 'topRight';
        const isLeft = corner === 'topLeft' || corner === 'bottomLeft';
        const x = isLeft ? frameX : frameX + frameWidth;
        const y = isTop ? frameY : frameY + frameHeight;

        return (
          <div
            key={corner}
            className={buildClassName(styles.cropCorner, styles[corner])}
            style={buildStyle(`left: ${x}px`, `top: ${y}px`)}
            onMouseDown={(e) => onCornerResizeStart(e, corner)}
            onTouchStart={(e) => onCornerResizeStart(e, corner)}
          />
        );
      })}
    </div>
  );
}

export default memo(CropOverlay);
