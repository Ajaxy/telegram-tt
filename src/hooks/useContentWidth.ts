import type { ElementRef } from '../lib/teact/teact';
import { useEffect, useRef } from '../lib/teact/teact';
import { setExtraStyles } from '../lib/teact/teact-dom';

import { requestMeasure, requestMutation, requestNextMutation } from '../lib/fasterdom/fasterdom';

const WIDTH_OVERSHOOT = 1;

export default function useContentWidth(
  targetRef: ElementRef<HTMLElement>,
  contentRef: ElementRef<HTMLElement>,
  deps: readonly unknown[],
) {
  const isFirstRunRef = useRef(true);

  useEffect(() => {
    requestMeasure(() => {
      const target = targetRef.current;
      const content = contentRef.current;
      if (!target || !content) return;

      const { paddingLeft, paddingRight } = getComputedStyle(target);
      const width = content.scrollWidth + parseFloat(paddingLeft) + parseFloat(paddingRight) + WIDTH_OVERSHOOT;

      requestMutation(() => {
        if (!isFirstRunRef.current) {
          setExtraStyles(target, { width: `${width}px` });
          return;
        }

        isFirstRunRef.current = false;
        setExtraStyles(target, { width: `${width}px`, transition: 'none' });
        requestNextMutation(() => {
          setExtraStyles(target, { width: `${width}px`, transition: '' });
        });
      });
    });
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, deps);
}
