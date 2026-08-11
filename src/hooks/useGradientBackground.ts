import { useEffect, useRef } from '../lib/teact/teact';

import type { GradientRenderer } from '../util/gradientBackground';

import { requestMutation } from '../lib/fasterdom/fasterdom';
import { createGradientRenderer, renderStaticGradient } from '../util/gradientBackground';

// The gradient is smooth, so a small canvas stretched by CSS keeps it cheap
const CANVAS_SIZE = 100;

export default function useGradientBackground(
  colors?: string[], shouldSnap?: boolean, isStatic?: boolean, rotation?: number,
) {
  const canvasRef = useRef<HTMLCanvasElement>();
  const rendererRef = useRef<GradientRenderer>();

  const colorsKey = colors?.join(',');
  // Read at mutation time so a color change picks up the current mode without re-running the effect
  const shouldSnapRef = useRef(shouldSnap);
  shouldSnapRef.current = shouldSnap;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !colors?.length) {
      rendererRef.current?.destroy();
      rendererRef.current = undefined;
      return undefined;
    }

    let isCancelled = false;

    // Resizing the canvas is a DOM write, so it must happen in the mutation phase
    requestMutation(() => {
      if (isCancelled) return;

      if (isStatic) {
        // A previous animated renderer must release its context before the canvas switches to 2D
        rendererRef.current?.destroy();
        rendererRef.current = undefined;
        renderStaticGradient(canvas, colors, rotation);
        canvas.dataset.ready = 'true';
        return;
      }

      // Keep the renderer alive across color changes so it can morph to the new colors
      if (rendererRef.current) {
        rendererRef.current.update(colors, shouldSnapRef.current, rotation);
        return;
      }

      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      rendererRef.current = createGradientRenderer(canvas, colors, rotation);
      if (rendererRef.current) {
        // Reveal the canvas only once the gradient is drawn, so CSS can fade it in over the base color
        canvas.dataset.ready = 'true';
      } else {
        // WebGL is unavailable or initialization failed after claiming the canvas; the static
        // renderer handles both cases and remains masked by the pattern in masked mode
        renderStaticGradient(canvas, colors, rotation);
        canvas.dataset.ready = 'true';
      }
    });

    return () => {
      isCancelled = true;
    };
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
