import { useRef } from '@teact';

import type { CropState } from '../../../../types/mediaEditor';
import type { ResizeHandle } from '../crop';
import type { Size } from '../render/transform';

import { clamp } from '../../../../util/math';
import { computeCenteredCrop, getAspectRatioValue } from '../crop';
import { getEffectiveDimensions } from '../render/transform';

import useLastCallback from '../../../../hooks/useLastCallback';
import useWindow from '../../../../hooks/useWindow';

const MIN_CROP_SIZE = 50;
const MIN_ROTATION = -90;
const MAX_ROTATION = 90;
const QUARTER_TURNS_IN_TURN = 4;

interface UseCropperOptions {
  sourceSize?: Size;
  displayScale: number;
  getDisplayCoordinates: (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => { x: number; y: number };
  lockedAspectRatio?: number;
  getCrop: () => CropState;
  onPreview: (crop: CropState) => void;
  onCommit: (crop: CropState) => void;
}

export default function useCropper({
  sourceSize,
  displayScale,
  getDisplayCoordinates,
  lockedAspectRatio,
  getCrop,
  onPreview,
  onCommit,
}: UseCropperOptions) {
  const renderingWindow = useWindow();
  const getRatio = (crop: CropState, quarterTurns = crop.quarterTurns) => (
    lockedAspectRatio ?? getAspectRatioValue(crop.aspectRatio, sourceSize!, quarterTurns)
  );

  const cropperDragStartRef = useRef<{
    startX: number;
    startY: number;
    cropperX: number;
    cropperY: number;
    cropperWidth: number;
    cropperHeight: number;
  }>();

  const setupDragListeners = (
    onMove: (ev: MouseEvent | TouchEvent) => void,
    onUp: () => void,
  ) => {
    const targetDocument = renderingWindow.document;
    const handleUp = () => {
      onUp();
      targetDocument.removeEventListener('mousemove', onMove);
      targetDocument.removeEventListener('touchmove', onMove);
      targetDocument.removeEventListener('mouseup', handleUp);
      targetDocument.removeEventListener('touchend', handleUp);
      targetDocument.removeEventListener('touchcancel', handleUp);
    };

    targetDocument.addEventListener('mousemove', onMove);
    targetDocument.addEventListener('touchmove', onMove);
    targetDocument.addEventListener('mouseup', handleUp);
    targetDocument.addEventListener('touchend', handleUp);
    targetDocument.addEventListener('touchcancel', handleUp);
  };

  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
    const { x, y } = getDisplayCoordinates(e);
    const crop = getCrop();

    cropperDragStartRef.current = {
      startX: x,
      startY: y,
      cropperX: crop.cropperX,
      cropperY: crop.cropperY,
      cropperWidth: crop.cropperWidth,
      cropperHeight: crop.cropperHeight,
    };
  };

  const handleDragEnd = () => {
    const startState = cropperDragStartRef.current;
    cropperDragStartRef.current = undefined;
    if (!startState) return;

    const crop = getCrop();
    if (startState.cropperX !== crop.cropperX
      || startState.cropperY !== crop.cropperY
      || startState.cropperWidth !== crop.cropperWidth
      || startState.cropperHeight !== crop.cropperHeight) {
      onCommit(crop);
    }
  };

  const handleCropperDragStart = useLastCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!sourceSize || !displayScale) return;

    e.preventDefault();
    e.stopPropagation();

    startDrag(e);

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      if (!cropperDragStartRef.current) return;

      const coords = getDisplayCoordinates(ev);
      const displayDeltaX = coords.x - cropperDragStartRef.current.startX;
      const displayDeltaY = coords.y - cropperDragStartRef.current.startY;

      const imageDeltaX = displayDeltaX / displayScale;
      const imageDeltaY = displayDeltaY / displayScale;

      const newCropperX = cropperDragStartRef.current.cropperX + imageDeltaX;
      const newCropperY = cropperDragStartRef.current.cropperY + imageDeltaY;

      const crop = getCrop();
      const { width: effW, height: effH } = getEffectiveDimensions(
        sourceSize.width, sourceSize.height, crop.quarterTurns,
      );
      const constrainedX = clamp(newCropperX, 0, effW - cropperDragStartRef.current.cropperWidth);
      const constrainedY = clamp(newCropperY, 0, effH - cropperDragStartRef.current.cropperHeight);

      onPreview({
        ...crop,
        cropperX: constrainedX,
        cropperY: constrainedY,
      });
    };

    setupDragListeners(handleMove, handleDragEnd);
  });

  const handleCornerResizeStart = useLastCallback((e: React.MouseEvent | React.TouchEvent, handle: ResizeHandle) => {
    if (!sourceSize || !displayScale) return;

    e.preventDefault();
    e.stopPropagation();

    startDrag(e);

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      if (!cropperDragStartRef.current) return;

      const coords = getDisplayCoordinates(ev);
      const displayDeltaX = coords.x - cropperDragStartRef.current.startX;
      const displayDeltaY = coords.y - cropperDragStartRef.current.startY;

      const imageDeltaX = displayDeltaX / displayScale;
      const imageDeltaY = displayDeltaY / displayScale;

      const startState = cropperDragStartRef.current;
      const crop = getCrop();
      const { width: effW, height: effH } = getEffectiveDimensions(
        sourceSize.width, sourceSize.height, crop.quarterTurns,
      );
      const isLeftHandle = handle === 'topLeft' || handle === 'bottomLeft';
      const isTopHandle = handle === 'topLeft' || handle === 'topRight';
      const ratioValue = getRatio(crop);

      let newWidth = startState.cropperWidth + (isLeftHandle ? -imageDeltaX : imageDeltaX);
      let newHeight = startState.cropperHeight + (isTopHandle ? -imageDeltaY : imageDeltaY);

      if (ratioValue) {
        if (newWidth / newHeight > ratioValue) {
          newWidth = newHeight * ratioValue;
        } else {
          newHeight = newWidth / ratioValue;
        }
      }

      if (newWidth < MIN_CROP_SIZE) {
        newWidth = MIN_CROP_SIZE;
        if (ratioValue) newHeight = MIN_CROP_SIZE / ratioValue;
      }
      if (newHeight < MIN_CROP_SIZE) {
        newHeight = MIN_CROP_SIZE;
        if (ratioValue) newWidth = MIN_CROP_SIZE * ratioValue;
      }

      // Clamp to image bounds, keeping the opposite corner fixed
      const anchorX = isLeftHandle ? startState.cropperX + startState.cropperWidth : startState.cropperX;
      const anchorY = isTopHandle ? startState.cropperY + startState.cropperHeight : startState.cropperY;
      const maxWidth = isLeftHandle ? anchorX : effW - anchorX;
      const maxHeight = isTopHandle ? anchorY : effH - anchorY;

      if (ratioValue) {
        const fitScale = Math.min(1, maxWidth / newWidth, maxHeight / newHeight);
        newWidth *= fitScale;
        newHeight *= fitScale;
      } else {
        newWidth = Math.min(newWidth, maxWidth);
        newHeight = Math.min(newHeight, maxHeight);
      }

      onPreview({
        ...crop,
        cropperX: isLeftHandle ? anchorX - newWidth : anchorX,
        cropperY: isTopHandle ? anchorY - newHeight : anchorY,
        cropperWidth: newWidth,
        cropperHeight: newHeight,
      });
    };

    setupDragListeners(handleMove, handleDragEnd);
  });

  const isRotatingRef = useRef(false);

  const handleRotationChange = useLastCallback((value: number) => {
    if (!sourceSize) return;

    isRotatingRef.current = true;

    const crop = getCrop();
    const { width: effW, height: effH } = getEffectiveDimensions(
      sourceSize.width, sourceSize.height, crop.quarterTurns,
    );

    onPreview({
      ...crop,
      rotation: clamp(value, MIN_ROTATION, MAX_ROTATION),
      ...computeCenteredCrop(effW, effH, getRatio(crop)),
    });
  });

  const handleRotationChangeEnd = useLastCallback(() => {
    if (isRotatingRef.current) {
      isRotatingRef.current = false;
      onCommit(getCrop());
    }
  });

  const handleQuarterRotate = useLastCallback(() => {
    if (!sourceSize) return;

    const crop = getCrop();
    const newQuarterTurns = (crop.quarterTurns + 1) % QUARTER_TURNS_IN_TURN;
    const { width: newEffW, height: newEffH } = getEffectiveDimensions(
      sourceSize.width, sourceSize.height, newQuarterTurns,
    );

    onCommit({
      ...crop,
      quarterTurns: newQuarterTurns,
      rotation: 0,
      ...computeCenteredCrop(newEffW, newEffH, getRatio(crop, newQuarterTurns)),
    });
  });

  // Mirrors the result on screen, which in source space also reverses the rotation
  const handleFlip = useLastCallback(() => {
    if (!sourceSize) return;

    const crop = getCrop();
    const { width: effW } = getEffectiveDimensions(
      sourceSize.width, sourceSize.height, crop.quarterTurns,
    );

    onCommit({
      ...crop,
      flipH: !crop.flipH,
      rotation: -crop.rotation,
      quarterTurns: (QUARTER_TURNS_IN_TURN - crop.quarterTurns) % QUARTER_TURNS_IN_TURN,
      cropperX: effW - crop.cropperX - crop.cropperWidth,
    });
  });

  return {
    handleCropperDragStart,
    handleCornerResizeStart,
    handleRotationChange,
    handleRotationChangeEnd,
    handleQuarterRotate,
    handleFlip,
  };
}
