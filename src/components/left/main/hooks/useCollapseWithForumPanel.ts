import { useLayoutEffect } from '../../../../lib/teact/teact';
import { fastRaf } from '../../../../util/schedulers';
import { ANIMATION_END_DELAY } from '../../../../config';

const ANIMATION_DURATION = 450;

// Reduce height of forum chat items when opening Forum Panel
export default function useCollapseWithForumPanel(
  containerRef: React.RefObject<HTMLDivElement>,
  isForumPanelOpen = false,
) {
  useLayoutEffect(() => {
    const chatEls = Array.from(containerRef.current!.querySelectorAll<HTMLDivElement>('.Chat'));

    chatEls.forEach((chatEl) => {
      const offsetCollapseDelta = Number(chatEl.dataset.offsetCollapseDelta);
      chatEl.style.transform = `translateY(${isForumPanelOpen ? offsetCollapseDelta : -offsetCollapseDelta!}px)`;
    });

    fastRaf(() => {
      chatEls.forEach((chatEl) => {
        chatEl.classList.add('animate-collapse');
        chatEl.style.transform = '';
      });
    });

    setTimeout(() => {
      // Wait one more frame for better animation performance
      fastRaf(() => {
        chatEls.forEach((chatEl) => {
          chatEl.classList.remove('animate-collapse');
        });
      });
    }, ANIMATION_DURATION + ANIMATION_END_DELAY);
  }, [containerRef, isForumPanelOpen]);
}
