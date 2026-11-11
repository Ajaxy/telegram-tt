import { memo } from '@teact';

import type { CropState } from '../../../../types/mediaEditor';
import type { ResizeHandle } from '../crop';
import type { Size } from '../render/transform';
import type { AvatarShape } from '../types';

import buildClassName from '../../../../util/buildClassName';
import buildStyle from '../../../../util/buildStyle';

import styles from '../MediaEditor.module.scss';

type OwnProps = {
  cropState: CropState;
  displaySize: Size;
  scale: number;
  avatarShape?: AvatarShape;
  onCropperDragStart: (e: React.MouseEvent | React.TouchEvent) => void;
  onCornerResizeStart: (e: React.MouseEvent | React.TouchEvent, handle: ResizeHandle) => void;
};

const CORNERS: ResizeHandle[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

function CropOverlay({
  cropState,
  displaySize,
  scale,
  avatarShape,
  onCropperDragStart,
  onCornerResizeStart,
}: OwnProps) {
  const { cropperX, cropperY, cropperWidth, cropperHeight } = cropState;

  const frameWidth = cropperWidth * scale;
  const frameHeight = cropperHeight * scale;

  if (frameWidth === 0 || frameHeight === 0) return undefined;

  return (
    <div
      className={styles.cropFrame}
      style={buildStyle(
        `left: calc(50% + ${cropperX * scale - displaySize.width / 2}px)`,
        `top: calc(50% + ${cropperY * scale - displaySize.height / 2}px)`,
        `width: ${frameWidth}px`,
        `height: ${frameHeight}px`,
      )}
      onMouseDown={onCropperDragStart}
      onTouchStart={onCropperDragStart}
    >
      {avatarShape && (
        <div className={buildClassName(styles.avatarMask, avatarShape === 'roundedSquare' && styles.roundedSquare)} />
      )}
      <div className={styles.cropGrid} />
      {CORNERS.map((corner) => (
        <div
          key={corner}
          className={buildClassName(styles.cropCorner, styles[corner])}
          onMouseDown={(e) => onCornerResizeStart(e, corner)}
          onTouchStart={(e) => onCornerResizeStart(e, corner)}
        />
      ))}
    </div>
  );
}

export default memo(CropOverlay);
