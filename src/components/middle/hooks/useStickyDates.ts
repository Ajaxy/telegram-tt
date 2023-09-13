import { requestMutation } from '../../../lib/fasterdom/fasterdom';

import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';
import useRunDebounced from '../../../hooks/useRunDebounced';

const DEBOUNCE = 1000;
const STICKY_TOP = 10;
const STICKY_TOP_WITH_TOOLS = 60;

export default function useStickyDates() {
  // For some reason we can not synchronously hide a sticky element (from `useLayoutEffect`) when chat opens
  // so we will add `position: sticky` only after first scroll. There would be no animation on the first show though.
  const [isScrolled, markIsScrolled] = useFlag(false);

  const runDebounced = useRunDebounced(DEBOUNCE, true);

  const updateStickyDates = useLastCallback((container: HTMLDivElement, hasTools?: boolean) => {
    markIsScrolled();

    if (!document.body.classList.contains('is-scrolling-messages')) {
      requestMutation(() => {
        document.body.classList.add('is-scrolling-messages');
      });
    }

    runDebounced(() => {
      const stuckDateEl = findStuckDate(container, hasTools);
      if (stuckDateEl) {
        requestMutation(() => {
          stuckDateEl.classList.add('stuck');
        });
      }

      requestMutation(() => {
        const currentStuck = document.querySelector('.stuck');
        if (currentStuck) {
          currentStuck.classList.remove('stuck');
        }

        document.body.classList.remove('is-scrolling-messages');
      });
    });
  });

  return {
    isScrolled,
    updateStickyDates,
  };
}

function findStuckDate(container: HTMLElement, hasTools?: boolean) {
  const allElements = container.querySelectorAll<HTMLDivElement>('.sticky-date');
  const containerTop = container.scrollTop;

  return Array.from(allElements).find((el) => {
    const { offsetTop, offsetHeight } = el;
    const top = offsetTop - containerTop;
    return -offsetHeight <= top && top <= (hasTools ? STICKY_TOP_WITH_TOOLS : STICKY_TOP);
  });
}
