import type { ElementRef } from '@teact';
import { useEffect, useLayoutEffect } from '@teact';
import { addExtraClass, removeExtraClass, toggleExtraClass } from '@teact/teact-dom.ts';

import { requestMutation } from '../lib/fasterdom/fasterdom.ts';
import { throttle } from '../util/schedulers.ts';

const THROTTLE_DELAY = 100;
const SCROLL_THRESHOLD = 5;

const useScrollNotch = ({
  containerRef,
  selector,
  isBottomNotch,
  shouldHideTopNotch,
}: {
  containerRef: ElementRef<HTMLDivElement>;
  selector: string;
  isBottomNotch?: boolean;
  shouldHideTopNotch?: boolean;
}, deps: unknown[]) => {
  useLayoutEffect(() => {
    const elements = containerRef.current?.querySelectorAll<HTMLElement>(selector);
    if (!elements?.length) return undefined;

    const handleScroll = throttle((event: Event) => {
      const target = event.target as HTMLElement;
      const isScrolled = target.scrollTop > 0;
      const { scrollHeight, scrollTop, clientHeight } = target;
      const isAtEnd = scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD;

      requestMutation(() => {
        if (!shouldHideTopNotch) {
          toggleExtraClass(target, 'scrolled', isScrolled);
        }
        if (isBottomNotch) {
          toggleExtraClass(target, 'scrolled-to-end', isAtEnd);
        }
      });
    }, THROTTLE_DELAY);

    elements.forEach((el) => {
      if (!shouldHideTopNotch) {
        addExtraClass(el, 'with-notch');
      }
      if (isBottomNotch) {
        addExtraClass(el, 'with-bottom-notch');
      }
      el.addEventListener('scroll', handleScroll, { passive: true });
    });

    return () => {
      elements.forEach((el) => {
        el.removeEventListener('scroll', handleScroll);
        removeExtraClass(el, 'with-notch');
        removeExtraClass(el, 'with-bottom-notch');
        removeExtraClass(el, 'scrolled');
        removeExtraClass(el, 'scrolled-to-end');
      });
    };
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [containerRef, selector, isBottomNotch, shouldHideTopNotch, ...deps]);

  useEffect(() => {
    const elements = containerRef.current?.querySelectorAll<HTMLElement>(selector);
    if (!elements?.length) return undefined;

    elements.forEach((el) => {
      const isScrolled = el.scrollTop > 0;
      const { scrollHeight, scrollTop, clientHeight } = el;
      const isAtEnd = scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD;

      requestMutation(() => {
        if (!shouldHideTopNotch) {
          toggleExtraClass(el, 'scrolled', isScrolled);
        }
        if (isBottomNotch) {
          toggleExtraClass(el, 'scrolled-to-end', isAtEnd);
        }
      });
    });
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [containerRef, selector, isBottomNotch, shouldHideTopNotch, ...deps]);
};

export default useScrollNotch;
