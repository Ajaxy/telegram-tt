import { useEffect, useMemo, useRef, useState } from '@teact';

import type { DrawAction } from '../canvasUtils';
import type { CropState } from './useCropper';

import { fastRaf, throttleWith } from '../../../../util/schedulers';
import {
  applyCanvasTransform, ARROW_ANIMATION_DURATION, computeRotationZoom,
  getEffectiveDimensions, renderActionsToCanvas, renderImageToCanvas,
} from '../canvasUtils';
import { getTotalRotation } from './useCropper';

import useLastCallback from '../../../../hooks/useLastCallback';

interface UseCanvasRendererOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | undefined>;
  imageRef: React.RefObject<HTMLImageElement | undefined>;
  mode: 'crop' | 'draw';
  cropState: CropState;
  drawActions: DrawAction[];
  currentDrawAction?: DrawAction;
}

export default function useCanvasRenderer({
  canvasRef,
  imageRef,
  mode,
  cropState,
  drawActions,
  currentDrawAction,
}: UseCanvasRendererOptions) {
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const renderCanvas = useLastCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const crop = {
      x: cropState.cropperX, y: cropState.cropperY,
      width: cropState.cropperWidth, height: cropState.cropperHeight,
    };
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rotation = getTotalRotation(cropState);
    const { flipH } = cropState;

    if (mode === 'crop') {
      const { width: effW, height: effH } = getEffectiveDimensions(
        img.width, img.height, cropState.quarterTurns,
      );
      const zoom = computeRotationZoom(effW, effH, cropState.rotation);

      if (canvasSize.width !== effW || canvasSize.height !== effH) {
        setCanvasSize({ width: effW, height: effH });
        return;
      }

      renderImageToCanvas(ctx, img, crop, effW, effH, true, rotation, flipH, cropState.quarterTurns, zoom);

      const hasTransforms = rotation !== 0 || flipH || cropState.quarterTurns !== 0 || zoom !== 1;
      if (hasTransforms) {
        ctx.save();
        applyCanvasTransform(ctx, img, rotation, flipH, cropState.quarterTurns, zoom);
        renderActionsToCanvas(ctx, drawActions, 0, 0, undefined, img.width, img.height);
        ctx.restore();
      } else {
        renderActionsToCanvas(ctx, drawActions);
      }
    } else {
      if (crop.width <= 0 || crop.height <= 0) return;

      const targetWidth = Math.round(crop.width);
      const targetHeight = Math.round(crop.height);

      if (canvasSize.width !== targetWidth || canvasSize.height !== targetHeight) {
        setCanvasSize({ width: targetWidth, height: targetHeight });
        return;
      }

      const { width: effW, height: effH } = getEffectiveDimensions(
        img.width, img.height, cropState.quarterTurns,
      );
      const zoom = computeRotationZoom(effW, effH, cropState.rotation);
      const hasTransforms = rotation !== 0 || flipH || cropState.quarterTurns !== 0 || zoom !== 1;

      // Create temp canvas at effective dimensions
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = effW;
      tempCanvas.height = effH;
      const tempCtx = tempCanvas.getContext('2d')!;

      if (hasTransforms) {
        tempCtx.save();
        applyCanvasTransform(tempCtx, img, rotation, flipH, cropState.quarterTurns, zoom);
      }

      // Draw image and actions (in image coords, transformed to effective space)
      tempCtx.drawImage(img, 0, 0);
      renderActionsToCanvas(tempCtx, drawActions, 0, 0, currentDrawAction, img.width, img.height);

      if (hasTransforms) {
        tempCtx.restore();
      }

      // Crop from effective space
      ctx.drawImage(tempCanvas, crop.x, crop.y, crop.width, crop.height, 0, 0, targetWidth, targetHeight);
    }
  });

  // Throttle re-renders to one per animation frame
  const scheduleRender = useMemo(() => throttleWith(fastRaf, renderCanvas), [renderCanvas]);

  // Re-render canvas when dependencies change
  useEffect(() => {
    scheduleRender();
  }, [drawActions, currentDrawAction, canvasSize, mode, cropState, scheduleRender]);

  // Animation loop for arrow spreading effect
  const animationFrameRef = useRef<number>();
  useEffect(() => {
    const hasAnimatingArrow = () => drawActions.some((action) => {
      return action.tool === 'arrow' && action.completedAt
        && (Date.now() - action.completedAt) < ARROW_ANIMATION_DURATION;
    });

    if (!hasAnimatingArrow()) return undefined;

    const animate = () => {
      renderCanvas();
      if (hasAnimatingArrow()) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [drawActions, renderCanvas]);

  const resetCanvasSize = useLastCallback(() => {
    setCanvasSize({ width: 0, height: 0 });
  });

  return {
    canvasSize,
    renderCanvas,
    resetCanvasSize,
  };
}
