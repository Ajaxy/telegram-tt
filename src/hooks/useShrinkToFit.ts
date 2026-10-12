import type { ElementRef } from '../lib/teact/teact';

import { requestMeasure, requestMutation } from '../lib/fasterdom/fasterdom';
import useLastCallback from './useLastCallback';
import useResizeObserver from './useResizeObserver';

// The content keeps its layout width under the transform, so the observer never sees its own result
export default function useShrinkToFit(
  containerRef: ElementRef<HTMLElement>,
  contentRef: ElementRef<HTMLElement>,
) {
  const fit = useLastCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    requestMeasure(() => {
      const available = container.clientWidth;
      const natural = content.offsetWidth;
      const scale = available && natural > available ? available / natural : 1;

      requestMutation(() => {
        container.style.setProperty('--fit-scale', String(scale));
      });
    });
  });

  useResizeObserver(contentRef, fit);
  useResizeObserver(containerRef, fit);
}
