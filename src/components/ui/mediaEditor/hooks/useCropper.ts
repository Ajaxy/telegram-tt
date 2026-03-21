import { useRef } from '@teact';

import { clamp } from '../../../../util/math';
import { getEffectiveDimensions } from '../canvasUtils';

import useLastCallback from '../../../../hooks/useLastCallback';

export interface CropState {
  cropperX: number;
  cropperY: number;
  cropperWidth: number;
  cropperHeight: number;
  aspectRatio: AspectRatio;
  rotation: number;
  quarterTurns: number;
  flipH: boolean;
}

export function getTotalRotation(state: CropState): number {
  return state.rotation - state.quarterTurns * 90;
}

export type AspectRatio =
  'free' | 'original' | 'square' | '3:2' | '2:3' | '4:3' | '3:4' | '5:4' | '4:5' | '16:9' | '9:16';

export type ResizeHandle = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

interface AspectRatioOption {
  value: AspectRatio;
  labelKey?: 'Free' | 'Original' | 'Square';
  label?: string;
  ratio?: number;
}

export const ASPECT_RATIOS: AspectRatioOption[] = [
  { value: 'free', labelKey: 'Free' },
  { value: 'original', labelKey: 'Original' },
  { value: 'square', labelKey: 'Square', ratio: 1 },
  { value: '3:2', label: '3:2', ratio: 3 / 2 },
  { value: '2:3', label: '2:3', ratio: 2 / 3 },
  { value: '4:3', label: '4:3', ratio: 4 / 3 },
  { value: '3:4', label: '3:4', ratio: 3 / 4 },
  { value: '5:4', label: '5:4', ratio: 5 / 4 },
  { value: '4:5', label: '4:5', ratio: 4 / 5 },
  { value: '16:9', label: '16:9', ratio: 16 / 9 },
  { value: '9:16', label: '9:16', ratio: 9 / 16 },
];

export const DEFAULT_CROP_STATE: CropState = {
  cropperX: 0,
  cropperY: 0,
  cropperWidth: 0,
  cropperHeight: 0,
  aspectRatio: 'free',
  rotation: 0,
  quarterTurns: 0,
  flipH: false,
};

export interface CropAction {
  type: 'crop';
  previousState: CropState;
}

const MIN_CROP_SIZE = 50;
const MIN_ROTATION = -90;
const MAX_ROTATION = 90;

function computeCenteredCrop(effW: number, effH: number, ratioValue: number | undefined) {
  let width: number;
  let height: number;

  if (!ratioValue) {
    width = effW;
    height = effH;
  } else if (effW / effH > ratioValue) {
    height = effH;
    width = effH * ratioValue;
  } else {
    width = effW;
    height = effW / ratioValue;
  }

  return {
    cropperX: (effW - width) / 2,
    cropperY: (effH - height) / 2,
    cropperWidth: width,
    cropperHeight: height,
  };
}

interface UseCropperOptions {
  imageRef: React.RefObject<HTMLImageElement | undefined>;
  displaySize: { width: number; height: number };
  getDisplayScale: () => number;
  getDisplayCoordinates: (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => { x: number; y: number };
  onAction: (action: CropAction) => void;
  cropState: CropState;
  setCropState: (value: CropState | ((prev: CropState) => CropState)) => void;
}

export default function useCropper({
  imageRef,
  displaySize,
  getDisplayScale,
  getDisplayCoordinates,
  onAction,
  cropState,
  setCropState,
}: UseCropperOptions) {
  const cropperDragStartRef = useRef<{
    startX: number;
    startY: number;
    cropperX: number;
    cropperY: number;
    cropperWidth: number;
    cropperHeight: number;
  }>();

  const cropStateRef = useRef<CropState>(DEFAULT_CROP_STATE);
  cropStateRef.current = cropState;

  const getAspectRatioValue = useLastCallback((ratio: AspectRatio): number | undefined => {
    if (ratio === 'free') return undefined;
    if (ratio === 'original' && imageRef.current) {
      const { width: effW, height: effH } = getEffectiveDimensions(
        imageRef.current.width, imageRef.current.height, cropStateRef.current.quarterTurns,
      );
      return effW / effH;
    }
    const option = ASPECT_RATIOS.find((r) => r.value === ratio);
    return option?.ratio;
  });

  const setupDragListeners = (
    onMove: (ev: MouseEvent | TouchEvent) => void,
    onUp: () => void,
  ) => {
    const handleUp = () => {
      onUp();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchend', handleUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchend', handleUp);
  };

  const handleCropperDragStart = useLastCallback((e: React.MouseEvent | React.TouchEvent) => {
    const img = imageRef.current;
    if (!img || displaySize.width === 0) return;

    e.preventDefault();
    e.stopPropagation();

    const { x, y } = getDisplayCoordinates(e);
    const displayScale = getDisplayScale();

    cropperDragStartRef.current = {
      startX: x,
      startY: y,
      cropperX: cropState.cropperX,
      cropperY: cropState.cropperY,
      cropperWidth: cropState.cropperWidth,
      cropperHeight: cropState.cropperHeight,
    };

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      if (!cropperDragStartRef.current) return;

      const coords = getDisplayCoordinates(ev);
      const displayDeltaX = coords.x - cropperDragStartRef.current.startX;
      const displayDeltaY = coords.y - cropperDragStartRef.current.startY;

      const imageDeltaX = displayDeltaX / displayScale;
      const imageDeltaY = displayDeltaY / displayScale;

      const newCropperX = cropperDragStartRef.current.cropperX + imageDeltaX;
      const newCropperY = cropperDragStartRef.current.cropperY + imageDeltaY;

      const { width: effW, height: effH } = getEffectiveDimensions(
        img.width, img.height, cropStateRef.current.quarterTurns,
      );
      const constrainedX = clamp(newCropperX, 0, effW - cropperDragStartRef.current.cropperWidth);
      const constrainedY = clamp(newCropperY, 0, effH - cropperDragStartRef.current.cropperHeight);

      setCropState((prev) => ({
        ...prev,
        cropperX: constrainedX,
        cropperY: constrainedY,
      }));
    };

    const handleUp = () => {
      if (cropperDragStartRef.current) {
        const startState = cropperDragStartRef.current;
        if (startState.cropperX !== cropStateRef.current.cropperX
          || startState.cropperY !== cropStateRef.current.cropperY) {
          const previousState: CropState = {
            ...cropStateRef.current,
            cropperX: startState.cropperX,
            cropperY: startState.cropperY,
            cropperWidth: startState.cropperWidth,
            cropperHeight: startState.cropperHeight,
          };
          onAction({ type: 'crop', previousState });
        }
      }
      cropperDragStartRef.current = undefined;
    };

    setupDragListeners(handleMove, handleUp);
  });

  const handleCornerResizeStart = useLastCallback((e: React.MouseEvent | React.TouchEvent, handle: ResizeHandle) => {
    const img = imageRef.current;
    if (!img || displaySize.width === 0) return;

    e.preventDefault();
    e.stopPropagation();

    const { x, y } = getDisplayCoordinates(e);
    const displayScale = getDisplayScale();

    cropperDragStartRef.current = {
      startX: x,
      startY: y,
      cropperX: cropState.cropperX,
      cropperY: cropState.cropperY,
      cropperWidth: cropState.cropperWidth,
      cropperHeight: cropState.cropperHeight,
    };

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      if (!cropperDragStartRef.current) return;

      const coords = getDisplayCoordinates(ev);
      const displayDeltaX = coords.x - cropperDragStartRef.current.startX;
      const displayDeltaY = coords.y - cropperDragStartRef.current.startY;

      const imageDeltaX = displayDeltaX / displayScale;
      const imageDeltaY = displayDeltaY / displayScale;

      const startState = cropperDragStartRef.current;
      const { width: effW, height: effH } = getEffectiveDimensions(
        img.width, img.height, cropStateRef.current.quarterTurns,
      );
      let newX = startState.cropperX;
      let newY = startState.cropperY;
      let newWidth = startState.cropperWidth;
      let newHeight = startState.cropperHeight;

      const ratioValue = getAspectRatioValue(cropStateRef.current.aspectRatio);

      if (handle === 'topLeft') {
        newX = startState.cropperX + imageDeltaX;
        newY = startState.cropperY + imageDeltaY;
        newWidth = startState.cropperWidth - imageDeltaX;
        newHeight = startState.cropperHeight - imageDeltaY;
      } else if (handle === 'topRight') {
        newY = startState.cropperY + imageDeltaY;
        newWidth = startState.cropperWidth + imageDeltaX;
        newHeight = startState.cropperHeight - imageDeltaY;
      } else if (handle === 'bottomLeft') {
        newX = startState.cropperX + imageDeltaX;
        newWidth = startState.cropperWidth - imageDeltaX;
        newHeight = startState.cropperHeight + imageDeltaY;
      } else if (handle === 'bottomRight') {
        newWidth = startState.cropperWidth + imageDeltaX;
        newHeight = startState.cropperHeight + imageDeltaY;
      }

      if (ratioValue) {
        const currentRatio = newWidth / newHeight;
        if (currentRatio > ratioValue) {
          const adjustedWidth = newHeight * ratioValue;
          if (handle === 'topLeft' || handle === 'bottomLeft') {
            newX += (newWidth - adjustedWidth);
          }
          newWidth = adjustedWidth;
        } else {
          const adjustedHeight = newWidth / ratioValue;
          if (handle === 'topLeft' || handle === 'topRight') {
            newY += (newHeight - adjustedHeight);
          }
          newHeight = adjustedHeight;
        }
      }

      if (newWidth < MIN_CROP_SIZE) {
        if (handle === 'topLeft' || handle === 'bottomLeft') {
          newX -= (MIN_CROP_SIZE - newWidth);
        }
        newWidth = MIN_CROP_SIZE;
        if (ratioValue) newHeight = MIN_CROP_SIZE / ratioValue;
      }
      if (newHeight < MIN_CROP_SIZE) {
        if (handle === 'topLeft' || handle === 'topRight') {
          newY -= (MIN_CROP_SIZE - newHeight);
        }
        newHeight = MIN_CROP_SIZE;
        if (ratioValue) newWidth = MIN_CROP_SIZE * ratioValue;
      }

      // Clamp to image bounds, keeping the opposite edge fixed
      const rightEdge = newX + newWidth;
      const bottomEdge = newY + newHeight;

      if (handle === 'topLeft' || handle === 'bottomLeft') {
        newX = Math.max(0, newX);
        newWidth = rightEdge - newX;
      } else {
        newWidth = Math.min(newWidth, effW - newX);
      }

      if (handle === 'topLeft' || handle === 'topRight') {
        newY = Math.max(0, newY);
        newHeight = bottomEdge - newY;
      } else {
        newHeight = Math.min(newHeight, effH - newY);
      }

      setCropState((prev) => ({
        ...prev,
        cropperX: newX,
        cropperY: newY,
        cropperWidth: newWidth,
        cropperHeight: newHeight,
      }));
    };

    const handleUp = () => {
      if (cropperDragStartRef.current) {
        const startState = cropperDragStartRef.current;
        if (startState.cropperX !== cropStateRef.current.cropperX
          || startState.cropperY !== cropStateRef.current.cropperY
          || startState.cropperWidth !== cropStateRef.current.cropperWidth
          || startState.cropperHeight !== cropStateRef.current.cropperHeight) {
          const previousState: CropState = {
            ...cropStateRef.current,
            cropperX: startState.cropperX,
            cropperY: startState.cropperY,
            cropperWidth: startState.cropperWidth,
            cropperHeight: startState.cropperHeight,
          };
          onAction({ type: 'crop', previousState });
        }
      }
      cropperDragStartRef.current = undefined;
    };

    setupDragListeners(handleMove, handleUp);
  });

  const handleAspectRatioChange = useLastCallback((newRatio: AspectRatio) => {
    const img = imageRef.current;
    if (!img) return;

    const previousState = { ...cropStateRef.current };
    const { width: effW, height: effH } = getEffectiveDimensions(
      img.width, img.height, cropStateRef.current.quarterTurns,
    );

    setCropState({
      ...cropStateRef.current,
      aspectRatio: newRatio,
      ...computeCenteredCrop(effW, effH, getAspectRatioValue(newRatio)),
    });
    onAction({ type: 'crop', previousState });
  });

  const initCropState = useLastCallback((width: number, height: number) => {
    setCropState({
      aspectRatio: 'free',
      cropperX: 0,
      cropperY: 0,
      cropperWidth: width,
      cropperHeight: height,
      rotation: 0,
      quarterTurns: 0,
      flipH: false,
    });
  });

  const getCroppedRegion = useLastCallback(() => {
    const { cropperX, cropperY, cropperWidth, cropperHeight } = cropStateRef.current;
    return {
      x: cropperX,
      y: cropperY,
      width: cropperWidth,
      height: cropperHeight,
    };
  });

  const rotationStartStateRef = useRef<CropState | undefined>();

  const handleRotationChange = useLastCallback((value: number) => {
    const img = imageRef.current;
    if (!img) return;

    if (!rotationStartStateRef.current) {
      rotationStartStateRef.current = { ...cropStateRef.current };
    }

    const { width: effW, height: effH } = getEffectiveDimensions(
      img.width, img.height, cropStateRef.current.quarterTurns,
    );

    setCropState({
      ...cropStateRef.current,
      rotation: clamp(value, MIN_ROTATION, MAX_ROTATION),
      ...computeCenteredCrop(effW, effH, getAspectRatioValue(cropStateRef.current.aspectRatio)),
    });
  });

  const handleRotationChangeEnd = useLastCallback(() => {
    if (rotationStartStateRef.current) {
      onAction({ type: 'crop', previousState: rotationStartStateRef.current });
      rotationStartStateRef.current = undefined;
    }
  });

  const handleQuarterRotate = useLastCallback(() => {
    const img = imageRef.current;
    if (!img) return;

    const previousState = { ...cropStateRef.current };
    const newQuarterTurns = (cropStateRef.current.quarterTurns + 1) % 4;
    const { width: newEffW, height: newEffH } = getEffectiveDimensions(
      img.width, img.height, newQuarterTurns,
    );

    setCropState({
      ...cropStateRef.current,
      quarterTurns: newQuarterTurns,
      rotation: 0,
      ...computeCenteredCrop(newEffW, newEffH, getAspectRatioValue(cropStateRef.current.aspectRatio)),
    });
    onAction({ type: 'crop', previousState });
  });

  const handleFlip = useLastCallback(() => {
    const img = imageRef.current;
    if (!img) return;

    const previousState = { ...cropStateRef.current };
    const { width: effW } = getEffectiveDimensions(
      img.width, img.height, cropStateRef.current.quarterTurns,
    );

    setCropState({
      ...cropStateRef.current,
      flipH: !cropStateRef.current.flipH,
      cropperX: effW - cropStateRef.current.cropperX - cropStateRef.current.cropperWidth,
    });
    onAction({ type: 'crop', previousState });
  });

  return {
    getCroppedRegion,
    initCropState,
    handleCropperDragStart,
    handleCornerResizeStart,
    handleAspectRatioChange,
    handleRotationChange,
    handleRotationChangeEnd,
    handleQuarterRotate,
    handleFlip,
  };
}
