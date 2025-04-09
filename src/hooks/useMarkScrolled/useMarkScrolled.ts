import type { RefObject } from '../../lib/teact/teact';
import { useEffect } from '../../lib/teact/teact';

import { requestMutation } from '../../lib/fasterdom/fasterdom';
import { throttle } from '../../util/schedulers';

const THROTTLE_DELAY = 100;

const useMarkScrolled = ({
  containerRef, selector,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  selector: string;
}, deps: unknown[]) => {
  useEffect(() => {
    const elements = containerRef?.current?.querySelectorAll(selector);
    if (!elements?.length) return undefined;

    const handleScroll = throttle((event: Event) => {
      const target = event.target as HTMLElement;
      const isScrolled = target.scrollTop > 0;
      requestMutation(() => {
        target.classList.toggle('scrolled', isScrolled);
      });
    }, THROTTLE_DELAY);

    elements.forEach((el) => el.addEventListener('scroll', handleScroll, { passive: true }));
    // Trigger the scroll handler immediately to apply the current state
    elements.forEach((el) => el.dispatchEvent(new Event('scroll', { bubbles: false })));

    return () => {
      elements.forEach((el) => el.removeEventListener('scroll', handleScroll));
    };
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [containerRef, selector, ...deps]);
};

export default useMarkScrolled;
