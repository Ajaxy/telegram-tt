import { useCallback, useEffect } from '../../../lib/teact/teact';

export default function useTransitionFixes(
  containerRef: { current: HTMLDivElement | null },
) {
  // Set `min-height` for shared media container to prevent jumping when switching tabs
  useEffect(() => {
    function setMinHeight() {
      const container = containerRef.current!;
      const transitionEl = container.querySelector<HTMLDivElement>('.Transition');
      const tabsEl = container.querySelector<HTMLDivElement>('.TabList');
      if (transitionEl && tabsEl) {
        transitionEl.style.minHeight = `${container.offsetHeight - tabsEl.offsetHeight}px`;
      }
    }

    setMinHeight();

    window.addEventListener('resize', setMinHeight, false);

    return () => {
      window.removeEventListener('resize', setMinHeight, false);
    };
  }, [containerRef]);

  // Workaround for scrollable content flickering during animation.
  const applyTransitionFix = useCallback(() => {
    const container = containerRef.current!;
    if (container.style.overflowY !== 'hidden') {
      const scrollBarWidth = container.offsetWidth - container.clientWidth;
      container.style.overflowY = 'hidden';
      container.style.marginRight = `${scrollBarWidth}px`;
    }
  }, [containerRef]);

  const releaseTransitionFix = useCallback(() => {
    const container = containerRef.current!;
    container.style.overflowY = 'scroll';
    container.style.marginRight = '0';
  }, [containerRef]);

  return { applyTransitionFix, releaseTransitionFix };
}
