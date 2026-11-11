import type { CropState } from '../../../../types/mediaEditor';

export type Size = { width: number; height: number };
export type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function getEffectiveDimensions(imgWidth: number, imgHeight: number, quarterTurns: number) {
  const isSideways = quarterTurns % 2 === 1;
  return {
    width: isSideways ? imgHeight : imgWidth,
    height: isSideways ? imgWidth : imgHeight,
  };
}

export function computeRotationZoom(effectiveW: number, effectiveH: number, fineRotation: number) {
  if (fineRotation === 0 || effectiveW <= 0 || effectiveH <= 0) return 1;
  const rad = Math.abs(fineRotation * Math.PI / 180);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return Math.max(
    cos + (effectiveH / effectiveW) * sin,
    (effectiveW / effectiveH) * sin + cos,
  );
}

export function applyCanvasTransform(
  ctx: Context2D,
  sourceSize: Size,
  rotation: number,
  flipH: boolean,
  quarterTurns = 0,
  scale = 1,
) {
  const { width: effW, height: effH } = getEffectiveDimensions(sourceSize.width, sourceSize.height, quarterTurns);
  ctx.translate(effW / 2, effH / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(scale * (flipH ? -1 : 1), scale);
  ctx.translate(-sourceSize.width / 2, -sourceSize.height / 2);
}

export function fitCropToMaxSide(
  { cropperWidth, cropperHeight }: Pick<CropState, 'cropperWidth' | 'cropperHeight'>, maxSide: number,
): Size {
  const scale = Math.min(1, maxSide / Math.max(cropperWidth, cropperHeight));
  return {
    width: Math.max(1, Math.round(cropperWidth * scale)),
    height: Math.max(1, Math.round(cropperHeight * scale)),
  };
}
