import type { ElementRef } from '../../../lib/teact/teact';
import { useEffect } from '../../../lib/teact/teact';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';

export default function useTransitionFixes(
  containerRef: ElementRef<HTMLDivElement>,
  transitionElSelector = '.Transition.shared-media-transition',
) {
  // Set `min-height` for shared media container to prevent jumping when switching tabs
  useEffect(() => {
    function setMinHeight() {
      const container = containerRef.current!;
      const transitionEl = container.querySelector<HTMLDivElement>(transitionElSelector);
      const tabsEl = container.querySelector<HTMLDivElement>('.TabList');
      if (transitionEl && tabsEl) {
        const newHeight = container.clientHeight - tabsEl.offsetHeight;

        requestMutation(() => {
          transitionEl.style.minHeight = `${newHeight}px`;
        });
      }
    }

    setMinHeight();

    window.addEventListener('resize', setMinHeight, false);

    return () => {
      window.removeEventListener('resize', setMinHeight, false);
    };
  }, [containerRef, transitionElSelector]);
}
