import { useEffect } from '../../../lib/teact/teact';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';

import useLastCallback from '../../../hooks/useLastCallback';

// Sometimes px values are rounded
const ROUNDING_COMPENSATION_PX = 1;

export default function useTransitionFixes(
  containerRef: { current: HTMLDivElement | null },
  transitionElSelector = '.Transition.shared-media-transition',
) {
  // Set `min-height` for shared media container to prevent jumping when switching tabs
  useEffect(() => {
    function setMinHeight() {
      const container = containerRef.current!;
      const transitionEl = container.querySelector<HTMLDivElement>(transitionElSelector);
      const tabsEl = container.querySelector<HTMLDivElement>('.TabList');
      if (transitionEl && tabsEl) {
        const newHeight = container.offsetHeight - tabsEl.offsetHeight + ROUNDING_COMPENSATION_PX;

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

  // Workaround for scrollable content flickering during animation.
  const applyTransitionFix = useLastCallback(() => {
    // This callback is called from `Transition.onStart` which is "mutate" phase
    requestMeasure(() => {
      const container = containerRef.current!;
      if (container.style.overflowY === 'hidden') return;

      const scrollBarWidth = container.offsetWidth - container.clientWidth;

      requestMutation(() => {
        container.style.overflowY = 'hidden';
        container.style.paddingRight = `${scrollBarWidth}px`;
      });
    });
  });

  const releaseTransitionFix = useLastCallback(() => {
    const container = containerRef.current!;
    container.style.overflowY = 'scroll';
    container.style.paddingRight = '0';
  });

  return { applyTransitionFix, releaseTransitionFix };
}
