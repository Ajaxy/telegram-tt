import type { CropState, MediaEditorAspectRatio as AspectRatio } from '../../../types/mediaEditor';
import type { Size } from './render/transform';

import { computeRotationZoom, getEffectiveDimensions } from './render/transform';

export function getTotalRotation(state: CropState): number {
  return state.rotation - state.quarterTurns * 90;
}

// Maps source pixels to the output frame, whose origin is the top left corner of the crop
export function getFrameMatrix(crop: CropState, sourceSize: Size) {
  const { width: effW, height: effH } = getEffectiveDimensions(sourceSize.width, sourceSize.height, crop.quarterTurns);
  const zoom = computeRotationZoom(effW, effH, crop.rotation);

  return new DOMMatrix()
    .translate(effW / 2 - crop.cropperX, effH / 2 - crop.cropperY)
    .rotate(getTotalRotation(crop))
    .scale(zoom * (crop.flipH ? -1 : 1), zoom)
    .translate(-sourceSize.width / 2, -sourceSize.height / 2);
}

export type ResizeHandle = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

interface AspectRatioOption {
  value: AspectRatio;
  labelKey?: 'AspectRatioFree' | 'AspectRatioOriginal' | 'AspectRatioSquare';
  label?: string;
  ratio?: number;
}

export const ASPECT_RATIOS: AspectRatioOption[] = [
  { value: 'free', labelKey: 'AspectRatioFree' },
  { value: 'original', labelKey: 'AspectRatioOriginal' },
  { value: 'square', labelKey: 'AspectRatioSquare', ratio: 1 },
  { value: '3:2', label: '3:2', ratio: 3 / 2 },
  { value: '2:3', label: '2:3', ratio: 2 / 3 },
  { value: '4:3', label: '4:3', ratio: 4 / 3 },
  { value: '3:4', label: '3:4', ratio: 3 / 4 },
  { value: '5:4', label: '5:4', ratio: 5 / 4 },
  { value: '4:5', label: '4:5', ratio: 4 / 5 },
  { value: '7:5', label: '7:5', ratio: 7 / 5 },
  { value: '5:7', label: '5:7', ratio: 5 / 7 },
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

export function computeCenteredCrop(effW: number, effH: number, ratioValue: number | undefined) {
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

export function getAspectRatioValue(ratio: AspectRatio, sourceSize: Size, quarterTurns: number): number | undefined {
  if (ratio === 'free') return undefined;
  if (ratio === 'original') {
    const { width: effW, height: effH } = getEffectiveDimensions(sourceSize.width, sourceSize.height, quarterTurns);
    return effW / effH;
  }
  const option = ASPECT_RATIOS.find((r) => r.value === ratio);
  return option?.ratio;
}

export function getCropWithAspectRatio(crop: CropState, aspectRatio: AspectRatio, sourceSize: Size): CropState {
  const { width: effW, height: effH } = getEffectiveDimensions(
    sourceSize.width, sourceSize.height, crop.quarterTurns,
  );

  return {
    ...crop,
    aspectRatio,
    ...computeCenteredCrop(effW, effH, getAspectRatioValue(aspectRatio, sourceSize, crop.quarterTurns)),
  };
}
