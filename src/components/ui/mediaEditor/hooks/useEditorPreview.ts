import {
  useEffect, useLayoutEffect, useMemo, useRef,
} from '@teact';

import type { DrawAction, MediaEditDocument } from '../../../../types/mediaEditor';
import type { Size } from '../render/transform';

import requestVideoFrame from '../../../../util/requestVideoFrame';
import { fastRaf, throttleWith } from '../../../../util/schedulers';
import { composeFrame, createFrameScratch } from '../render/composeFrame';
import { ARROW_ANIMATION_DURATION } from '../render/drawActions';

import useLastCallback from '../../../../hooks/useLastCallback';
import useDevicePixelRatio from '../../../../hooks/window/useDevicePixelRatio';

interface UseEditorPreviewOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | undefined>;
  frame?: CanvasImageSource;
  sourceSize?: Size;
  displaySize: Size;
  doc: MediaEditDocument;
  isCropMode: boolean;
  currentAction?: DrawAction;
  shouldRenderEveryFrame?: boolean;
  maxPixelRatio?: number;
}

const MAX_CANVAS_SIDE = 4096;

export default function useEditorPreview({
  canvasRef,
  frame,
  sourceSize,
  displaySize,
  doc,
  isCropMode,
  currentAction,
  shouldRenderEveryFrame,
  maxPixelRatio = Infinity,
}: UseEditorPreviewOptions) {
  const scratch = useMemo(createFrameScratch, []);
  const dpr = useDevicePixelRatio();
  const displayPixelRatio = Math.min(dpr, MAX_CANVAS_SIDE / Math.max(displaySize.width, displaySize.height));
  const pixelRatio = Math.min(displayPixelRatio, maxPixelRatio);
  const canvasWidth = Math.round(displaySize.width * pixelRatio);
  const canvasHeight = Math.round(displaySize.height * pixelRatio);
  const canvasSize = useMemo(() => ({ width: canvasWidth, height: canvasHeight }), [canvasWidth, canvasHeight]);
  // The CSS size follows the screen density, so a lower quality only lowers the backing store resolution
  const cssWidth = Math.round(displaySize.width * displayPixelRatio) / displayPixelRatio;
  const cssHeight = Math.round(displaySize.height * displayPixelRatio) / displayPixelRatio;
  const canvasCssSize = useMemo(() => ({ width: cssWidth, height: cssHeight }), [cssWidth, cssHeight]);

  const renderCanvas = useLastCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frame || !sourceSize || !canvasSize.width || (!isCropMode && !doc.crop.cropperWidth)) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    composeFrame({
      ctx,
      frame,
      sourceSize,
      doc,
      scratch,
      isCropMode,
      currentAction: isCropMode ? undefined : currentAction,
    });
  });

  const {
    crop, paint, adjustments, tint, curves,
  } = doc;
  const { rotation, quarterTurns, flipH } = crop;
  // The crop view always shows the whole frame, so moving the cropper does not change it
  const frameCrop = isCropMode ? undefined : crop;
  useLayoutEffect(() => {
    renderCanvas();
  }, [
    frameCrop, rotation, quarterTurns, flipH, paint, adjustments, tint, curves, currentAction, canvasSize, isCropMode,
    frame, renderCanvas,
  ]);

  // Throttle re-renders to one per animation frame
  const scheduleRender = useMemo(() => throttleWith(fastRaf, renderCanvas), [renderCanvas]);

  useEffect(() => {
    if (!(frame instanceof HTMLVideoElement)) return undefined;

    const video = frame;
    video.addEventListener('seeked', scheduleRender);

    let cancelFrame: NoneToVoidFunction | undefined;
    if (shouldRenderEveryFrame) {
      const renderNextFrame = () => {
        renderCanvas();
        cancelFrame = requestVideoFrame(video, renderNextFrame);
      };
      cancelFrame = requestVideoFrame(video, renderNextFrame);
    }

    return () => {
      video.removeEventListener('seeked', scheduleRender);
      cancelFrame?.();
    };
  }, [frame, shouldRenderEveryFrame, renderCanvas, scheduleRender]);

  // Animation loop for arrow spreading effect
  const animationFrameRef = useRef<number>();
  useEffect(() => {
    const hasAnimatingArrow = () => paint.some((action) => {
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
  }, [paint, renderCanvas]);

  return { canvasSize, canvasCssSize };
}
