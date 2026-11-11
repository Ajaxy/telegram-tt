import { useEffect, useLayoutEffect, useRef } from '../lib/teact/teact';

import type { GradientRenderer } from '../util/wallpaper/gradient';

import { requestMutation } from '../lib/fasterdom/fasterdom';
import { timingFunctions } from '../util/animation';
import { createGradientRenderer, renderStaticGradient } from '../util/wallpaper/gradient';

// The gradient is smooth, so a small canvas stretched by CSS keeps it cheap
const CANVAS_SIZE = 100;
// Matches `$wallpaper-transition` in `_patternBackground.module.scss`, so colors and doodles change together
export const WALLPAPER_TRANSITION_MS = 300;

export default function useGradientBackground(
  colors?: string[], shouldSnap?: boolean, isStatic?: boolean, rotation?: number,
) {
  const canvasRef = useRef<HTMLCanvasElement>();
  const rendererRef = useRef<GradientRenderer>();
  const aspectRatioRef = useRef(1);

  const colorsKey = colors?.join(',');

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !colors?.length) {
      rendererRef.current?.destroy();
      rendererRef.current = undefined;
      return undefined;
    }

    if (isStatic) {
      // Static previews must not be overwritten by pending animation frames
      rendererRef.current?.destroy();
      rendererRef.current = undefined;
      renderStaticGradient(canvas, colors, rotation, aspectRatioRef.current);
      canvas.dataset.ready = 'true';
      return undefined;
    }

    // Keep the renderer alive across color changes so it can morph to the new colors
    if (rendererRef.current) {
      rendererRef.current.update(colors, shouldSnap, rotation, aspectRatioRef.current);
      return undefined;
    }

    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    rendererRef.current = createGradientRenderer(canvas, colors, rotation, {
      aspectRatio: aspectRatioRef.current,
      colorMorphDurationMs: WALLPAPER_TRANSITION_MS,
      colorMorphEasing: timingFunctions.easeInOut,
    });
    if (!rendererRef.current) {
      renderStaticGradient(canvas, colors, rotation, aspectRatioRef.current);
    }
    canvas.dataset.ready = 'true';
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [colorsKey, shouldSnap, isStatic, rotation]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !colors?.length) return undefined;

    let isCanceled = false;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!width || !height) return;
      const aspectRatio = width / height;
      if (aspectRatio === aspectRatioRef.current) return;
      aspectRatioRef.current = aspectRatio;
      requestMutation(() => {
        if (isCanceled) return;
        if (rendererRef.current) {
          rendererRef.current.update(colors, true, rotation, aspectRatio);
        } else {
          renderStaticGradient(canvas, colors, rotation, aspectRatio);
        }
      });
    });
    observer.observe(canvas);
    return () => {
      isCanceled = true;
      observer.disconnect();
    };
    // The color key follows the same stops even when their array identity changes
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [colorsKey, isStatic, rotation]);

  useEffect(() => {
    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = undefined;
    };
  }, []);

  return canvasRef;
}
