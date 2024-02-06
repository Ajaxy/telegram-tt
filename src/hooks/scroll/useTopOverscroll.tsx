import React, { useEffect, useRef } from '../../lib/teact/teact';

import { forceMutation, requestMutation } from '../../lib/fasterdom/fasterdom';
import { stopScrollInertia } from '../../util/resetScroll';
import { IS_IOS, IS_SAFARI } from '../../util/windowEnvironment';
import useDebouncedCallback from '../useDebouncedCallback';
import useLastCallback from '../useLastCallback';

const MOUSE_WHEEL_DEBOUNCE = 250;
const TRIGGER_HEIGHT = 1;
const INERTIA_THRESHOLD = 100;

export default function useTopOverscroll(
  containerRef: React.RefObject<HTMLDivElement>,
  onOverscroll?: AnyToVoidFunction,
  onReset?: AnyToVoidFunction,
  isDisabled?: boolean,
) {
  // eslint-disable-next-line no-null/no-null
  const overscrollTriggerRef = useRef<HTMLDivElement>(null);

  const isTriggerJustEnabled = useRef(false);
  const lastScrollTopRef = useRef(0);
  const isTriggerEnabledRef = useRef(false);
  const lastIsOnTopRef = useRef(true);
  const lastScrollAtRef = useRef(0);
  const isReturningOverscrollRef = useRef(false);

  const enableOverscrollTrigger = useLastCallback((noScrollInertiaStop = false) => {
    if (isTriggerEnabledRef.current) return;
    if (!overscrollTriggerRef.current || !containerRef.current) return;

    overscrollTriggerRef.current.style.display = 'block';
    containerRef.current.scrollTop = TRIGGER_HEIGHT;

    if (!IS_SAFARI && !noScrollInertiaStop) {
      stopScrollInertia(containerRef.current);
    }

    isTriggerJustEnabled.current = true;
    lastScrollTopRef.current = TRIGGER_HEIGHT;
    isTriggerEnabledRef.current = true;
    lastIsOnTopRef.current = true;
  });

  const disableOverscrollTrigger = useLastCallback(() => {
    if (!isTriggerEnabledRef.current) return;
    if (!overscrollTriggerRef.current) return;

    overscrollTriggerRef.current.style.display = 'none';

    isTriggerEnabledRef.current = false;
  });

  const handleScroll = useLastCallback(() => {
    if (!containerRef.current) return;

    if (isTriggerJustEnabled.current) {
      isTriggerJustEnabled.current = false;

      return;
    }

    const newScrollTop = containerRef.current.scrollTop;
    const isMovingDown = newScrollTop > lastScrollTopRef.current;
    const isMovingUp = newScrollTop < lastScrollTopRef.current;
    const isOnTop = newScrollTop === 0;
    const lastEventDelay = Date.now() - lastScrollAtRef.current;

    if (overscrollTriggerRef.current) {
      if (isOnTop && !isTriggerEnabledRef.current) {
        forceMutation(enableOverscrollTrigger, [containerRef.current, overscrollTriggerRef.current]);
        return;
      }

      forceMutation(disableOverscrollTrigger, overscrollTriggerRef.current);
    }

    if (
      isMovingUp && (
        (lastIsOnTopRef.current && lastEventDelay > INERTIA_THRESHOLD)
        || (newScrollTop < 0 && isReturningOverscrollRef.current) // Overscroll repeated by the user
      )) {
      onOverscroll?.();
    } else if (isMovingDown && newScrollTop > 0) {
      onReset?.();
    }

    lastScrollTopRef.current = newScrollTop;
    lastIsOnTopRef.current = isOnTop;
    lastScrollAtRef.current = Date.now();
    isReturningOverscrollRef.current = isMovingDown && newScrollTop < 0;
  });

  // Handle non-scrollable container
  const handleWheel = useDebouncedCallback((event: WheelEvent) => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const isScrollable = container.scrollHeight > container.offsetHeight;
    if (isScrollable || event.deltaY === 0) return;

    if (event.deltaY < 0) {
      onOverscroll?.();
    } else {
      onReset?.();
    }
  }, [containerRef, onOverscroll, onReset], MOUSE_WHEEL_DEBOUNCE);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    if (container.scrollTop === 0) {
      requestMutation(() => {
        enableOverscrollTrigger(true);
      });
    }

    container.addEventListener('scroll', handleScroll, { passive: true });
    container.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('wheel', handleWheel);
    };
  }, [containerRef, handleWheel]);

  return !IS_IOS && !isDisabled ? (
    <div ref={overscrollTriggerRef} className="overscroll-trigger" key="overscroll-trigger" />
  ) : undefined;
}
