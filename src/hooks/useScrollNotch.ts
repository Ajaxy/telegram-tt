import type { ElementRef } from '@teact';
import { useEffect, useLayoutEffect } from '@teact';
import { addExtraClass, removeExtraClass, toggleExtraClass } from '@teact/teact-dom.ts';

import { requestMutation } from '../lib/fasterdom/fasterdom.ts';
import { throttle } from '../util/schedulers.ts';

const THROTTLE_DELAY = 100;

const useScrollNotch = ({
  containerRef,
  selector,
}: {
  containerRef: ElementRef<HTMLDivElement>;
  selector: string;
}, deps: unknown[]) => {
  useLayoutEffect(() => {
    const elements = containerRef.current?.querySelectorAll<HTMLElement>(selector);
    if (!elements?.length) return undefined;

    const handleScroll = throttle((event: Event) => {
      const target = event.target as HTMLElement;
      const isScrolled = target.scrollTop > 0;

      requestMutation(() => {
        toggleExtraClass(target, 'scrolled', isScrolled);
      });
    }, THROTTLE_DELAY);

    elements.forEach((el) => {
      addExtraClass(el, 'with-notch');
      el.addEventListener('scroll', handleScroll, { passive: true });
    });

    return () => {
      elements.forEach((el) => {
        el.removeEventListener('scroll', handleScroll);
        removeExtraClass(el, 'with-notch');
      });
    };
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [containerRef, selector, ...deps]);

  useEffect(() => {
    const elements = containerRef.current?.querySelectorAll<HTMLElement>(selector);
    if (!elements?.length) return undefined;

    elements.forEach((el) => {
      const isScrolled = el.scrollTop > 0;
      requestMutation(() => {
        toggleExtraClass(el, 'scrolled', isScrolled);
      });
    });
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [containerRef, selector, ...deps]);
};

export default useScrollNotch;
