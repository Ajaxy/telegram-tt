import type { ElementRef } from '../../../lib/teact/teact';
import { useEffect } from '../../../lib/teact/teact';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';

export default function useTransitionFixes(
  containerRef: ElementRef<HTMLDivElement>,
  transitionElSelector = '.Transition.shared-media-transition',
) {
  // Set `min-height` for shared media container to prevent jumping when switching tabs
  useEffect(() => {
    function setMinHeight() {
      requestMeasure(() => {
        const container = containerRef.current;
        if (!container) return;
        const transitionEl = container.querySelector<HTMLDivElement>(transitionElSelector);
        const tabsEl = container.querySelector<HTMLDivElement>('.shared-media-tabs');
        const sharedMediaEl = transitionEl?.parentElement;
        if (!transitionEl || !tabsEl) return;

        const sharedMediaMargin = sharedMediaEl
          ? parseInt(getComputedStyle(sharedMediaEl).marginTop, 10) || 0 : 0;
        const tabsMarginTop = parseInt(getComputedStyle(tabsEl).marginTop, 10) || 0;
        const newHeight = container.clientHeight - tabsEl.offsetHeight - tabsMarginTop - sharedMediaMargin;

        requestMutation(() => {
          transitionEl.style.minHeight = `${newHeight}px`;
        });
      });
    }

    setMinHeight();

    window.addEventListener('resize', setMinHeight, false);

    return () => {
      window.removeEventListener('resize', setMinHeight, false);
    };
  }, [containerRef, transitionElSelector]);
}
