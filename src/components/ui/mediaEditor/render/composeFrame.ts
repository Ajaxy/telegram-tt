import type { CropState, DrawAction, MediaEditDocument } from '../../../../types/mediaEditor';
import type { AdjustmentsProgram } from './adjustments/adjustmentsProgram';
import type { LayerFrames } from './layers';
import type { Context2D, Size } from './transform';

import { getTotalRotation } from '../crop';
import { createAdjustmentsProgram } from './adjustments/adjustmentsProgram';
import { hasColorAdjustments } from './adjustments/values';
import { renderActionsToCanvas } from './drawActions';
import { drawLayers } from './layers';
import { applyCanvasTransform, computeRotationZoom, getEffectiveDimensions } from './transform';

type FrameScratch = {
  paint: OffscreenCanvas;
  adjustments?: AdjustmentsProgram | false;
};

type ComposeFrameOptions = {
  ctx: Context2D;
  frame: CanvasImageSource;
  sourceSize: Size;
  doc: MediaEditDocument;
  scratch: FrameScratch;
  isCropMode?: boolean;
  shouldRequireAdjustments?: boolean;
  currentAction?: DrawAction;
  layerFrames?: LayerFrames;
  time?: number;
};

export function createFrameScratch(): FrameScratch {
  return {
    paint: new OffscreenCanvas(1, 1),
  };
}

export function disposeFrameScratch(scratch: FrameScratch) {
  if (scratch.adjustments) scratch.adjustments.dispose();
  scratch.adjustments = undefined;
}

export function composeFrame({
  ctx,
  frame,
  sourceSize,
  doc,
  scratch,
  isCropMode,
  shouldRequireAdjustments,
  currentAction,
  layerFrames,
  time,
}: ComposeFrameOptions) {
  const { width: targetWidth, height: targetHeight } = ctx.canvas;
  const source = applyAdjustments(frame, sourceSize, doc, scratch, shouldRequireAdjustments);

  ctx.clearRect(0, 0, targetWidth, targetHeight);
  ctx.imageSmoothingQuality = 'high';
  ctx.save();
  applyFrameTransform(ctx, sourceSize, doc.crop, isCropMode);
  ctx.drawImage(source, 0, 0);
  const sourceTransform = ctx.getTransform();
  ctx.restore();

  renderActionsToCanvas(ctx, scratch.paint, doc.paint, sourceTransform, currentAction);

  if (layerFrames && doc.layers?.length) {
    drawLayers(ctx, doc.layers, { width: targetWidth, height: targetHeight }, { frames: layerFrames, time });
  }
}

function applyFrameTransform(ctx: Context2D, sourceSize: Size, crop: CropState, isCropMode?: boolean) {
  const { quarterTurns, flipH } = crop;
  const { width: effW, height: effH } = getEffectiveDimensions(sourceSize.width, sourceSize.height, quarterTurns);
  const { width: targetWidth, height: targetHeight } = ctx.canvas;

  if (isCropMode) {
    ctx.scale(targetWidth / effW, targetHeight / effH);
  } else {
    ctx.scale(targetWidth / crop.cropperWidth, targetHeight / crop.cropperHeight);
    ctx.translate(-crop.cropperX, -crop.cropperY);
  }

  applyCanvasTransform(
    ctx, sourceSize, getTotalRotation(crop), flipH, quarterTurns, computeRotationZoom(effW, effH, crop.rotation),
  );
}

function applyAdjustments(
  frame: CanvasImageSource,
  sourceSize: Size,
  doc: MediaEditDocument,
  scratch: FrameScratch,
  shouldRequireAdjustments?: boolean,
) {
  if (!hasColorAdjustments(doc)) return frame;

  if (scratch.adjustments === undefined) {
    scratch.adjustments = createAdjustmentsProgram() || false;
  }
  if (!scratch.adjustments) {
    if (shouldRequireAdjustments) throw new Error('adjustmentsUnavailable');
    return frame;
  }

  return scratch.adjustments.render(frame, sourceSize, doc);
}
