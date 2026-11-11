import type { MediaEditDocument } from '../../../../types/mediaEditor';
import type { LayerFrames } from '../render/layers';
import type { Size } from '../render/transform';

import { composeFrame, createFrameScratch } from '../render/composeFrame';

export function exportImage(
  frame: CanvasImageSource,
  sourceSize: Size,
  doc: MediaEditDocument,
  mimeType: string,
  layerFrames?: LayerFrames,
  outputSize?: Size,
): Promise<Blob | undefined> {
  const { crop } = doc;
  if (crop.cropperWidth <= 0 || crop.cropperHeight <= 0) return Promise.resolve(undefined);

  const canvas = document.createElement('canvas');
  canvas.width = outputSize?.width ?? Math.round(crop.cropperWidth);
  canvas.height = outputSize?.height ?? Math.round(crop.cropperHeight);

  composeFrame({
    ctx: canvas.getContext('2d')!,
    frame,
    sourceSize,
    doc,
    scratch: createFrameScratch(),
    layerFrames,
  });

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob || undefined), mimeType);
  });
}

export function getExtensionFromMimeType(mimeType: string): string {
  return mimeType.split('/')[1];
}
