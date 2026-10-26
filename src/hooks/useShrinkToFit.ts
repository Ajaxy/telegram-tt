import { type ElementRef, useRef } from '../lib/teact/teact';

import { requestMutation } from '../lib/fasterdom/fasterdom';
import useResizeObserver from './useResizeObserver';

// The widths come from the observer entries: a layout read here would force a reflow on every frame of a width
// animation inside the content. The content keeps its layout width under the transform, so the observer never
// sees its own result.
export default function useShrinkToFit(
  containerRef: ElementRef<HTMLElement>,
  contentRef: ElementRef<HTMLElement>,
) {
  // The stylesheet falls back to 1, so content that fits costs no write
  const widthsRef = useRef<{ available?: number; natural?: number; scale: number }>({ scale: 1 });

  function fit() {
    const widths = widthsRef.current;
    const { available, natural } = widths;
    if (available === undefined || natural === undefined) return;

    const scale = available && natural > available ? available / natural : 1;
    if (scale === widths.scale) return;

    widths.scale = scale;
    requestMutation(() => {
      containerRef.current?.style.setProperty('--fit-scale', String(scale));
    });
  }

  useResizeObserver(contentRef, (entry) => {
    widthsRef.current.natural = entry.borderBoxSize[0].inlineSize;
    fit();
  });
  useResizeObserver(containerRef, (entry) => {
    widthsRef.current.available = entry.contentRect.width;
    fit();
  });
}
