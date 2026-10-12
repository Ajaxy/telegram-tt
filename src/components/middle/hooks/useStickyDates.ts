import { requestMutation } from '../../../lib/fasterdom/fasterdom';

import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';
import useRunDebounced from '../../../hooks/useRunDebounced';

const DEBOUNCE = 1000;
const STICKY_SELECTORS = ['.sticky-date', '.sticky-topic'];

export default function useStickyDates() {
  // For some reason we can not synchronously hide a sticky element (from `useLayoutEffect`) when chat opens
  // so we will add `position: sticky` only after first scroll. There would be no animation on the first show though.
  const [isScrolled, markIsScrolled] = useFlag(false);

  const runDebounced = useRunDebounced(DEBOUNCE, true);

  const updateStickyDates = useLastCallback((container: HTMLDivElement) => {
    markIsScrolled();

    if (!document.body.classList.contains('is-scrolling-messages')) {
      requestMutation(() => {
        document.body.classList.add('is-scrolling-messages');
      });
    }

    runDebounced(() => {
      // A hidden list has no layout, so every element would match
      const stuckElements = container.offsetParent
        ? STICKY_SELECTORS.flatMap((selector) => findStuckElements(container, selector))
        : [];

      requestMutation(() => {
        container.querySelectorAll('.stuck').forEach((el) => {
          el.classList.remove('stuck');
        });

        stuckElements.forEach((el) => {
          el.classList.add('stuck');
        });

        document.body.classList.remove('is-scrolling-messages');
      });
    });
  });

  return {
    isScrolled,
    updateStickyDates,
  };
}

function findStuckElements(container: HTMLElement, selector: string) {
  const allElements = container.querySelectorAll<HTMLDivElement>(selector);
  const containerTop = container.getBoundingClientRect().top;

  return Array.from(allElements).filter((el) => {
    const { top: elementTop, height } = el.getBoundingClientRect();
    const top = elementTop - containerTop;
    const stickyTop = parseFloat(getComputedStyle(el).top) || 0;
    return -height <= top && top <= stickyTop;
  });
}
