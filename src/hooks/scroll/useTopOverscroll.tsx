import { type ElementRef, useEffect, useRef, useSignal } from '@teact';

import { requestMutation } from '../../lib/fasterdom/fasterdom';
import stopEvent from '../../util/stopEvent';
import useLastCallback from '../useLastCallback';

type State = 'overscroll' | 'animating' | 'normal';

type ActiveScrollContext = {
  lastDeltas: number[];
  lastAverageDelta: number;
  isStartedAtTop: boolean;
  resetStartTopAt?: number;
  timeout: number | undefined;
};

const LAST_DELTA_COUNT = 7;
const ACTIVE_SCROLL_RESET_TIMEOUT = 100;
const NEW_INPUT_DELTA_THRESHOLD = 7;
const OVERSCROLL_CONTAINER_CLASS = 'no-overscroll';
const NO_TOUCH_CONTAINER_CLASS = 'no-touch';
const TRANSITION_DURATION = 350;
const DRAG_TRIGGER_DISTANCE = 75;

const initialActiveScrollContext: ActiveScrollContext = {
  lastDeltas: new Array(LAST_DELTA_COUNT).fill(0),
  lastAverageDelta: 0,
  isStartedAtTop: false,
  resetStartTopAt: undefined,
  timeout: undefined,
};

export default function useTopOverscroll({
  containerRef,
  isOverscrolled,
  isDisabled,
  onOverscroll,
  onReset,
}: {
  containerRef: ElementRef<HTMLDivElement>;
  isOverscrolled?: boolean;
  onOverscroll?: AnyToVoidFunction;
  onReset?: AnyToVoidFunction;
  isDisabled?: boolean;
},
) {
  const [getState, setState] = useSignal<State>('normal');
  const activeScrollRef = useRef<ActiveScrollContext>({ ...initialActiveScrollContext });
  const transitionTimeoutRef = useRef<number | undefined>();
  const touchStartYRef = useRef<number | undefined>();

  const triggerOverscroll = useLastCallback(() => {
    clearTimeout(transitionTimeoutRef.current);
    setState('overscroll');
    onOverscroll?.();
  });

  const triggerReset = useLastCallback(() => {
    setState('animating');
    transitionTimeoutRef.current = window.setTimeout(() => {
      setState('normal');
    }, TRANSITION_DURATION);
    onReset?.();
  });

  const scheduleResetActiveScroll = useLastCallback((timeout: number) => {
    clearTimeout(activeScrollRef.current.timeout);
    activeScrollRef.current.timeout = window.setTimeout(() => {
      activeScrollRef.current = { ...initialActiveScrollContext };
    }, timeout);
  });

  const handleWheel = useLastCallback((e: WheelEvent) => {
    const container = containerRef.current;
    if (!container || e.defaultPrevented) {
      return;
    }

    const { deltaY } = e;
    const { scrollTop } = container;
    const state = getState();

    const activeScroll = activeScrollRef.current;
    const lastAverageDelta = activeScroll.lastAverageDelta;

    const isStarting = activeScroll.lastDeltas.at(-1) === 0
      || (activeScroll.resetStartTopAt && Date.now() >= activeScroll.resetStartTopAt);
    if (scrollTop === 0 && isStarting) {
      activeScroll.isStartedAtTop = true;
      activeScroll.resetStartTopAt = undefined;
    }

    const lastDeltas = activeScrollRef.current.lastDeltas.slice(); // Copy
    lastDeltas.push(deltaY);
    if (lastDeltas.length > LAST_DELTA_COUNT) {
      lastDeltas.shift();
    }
    activeScrollRef.current.lastDeltas = lastDeltas;
    const currentAverageDelta = lastDeltas.reduce((a, b) => a + b, 0) / lastDeltas.length;
    activeScrollRef.current.lastAverageDelta = currentAverageDelta;

    const isNewInput = Math.abs(currentAverageDelta) - Math.abs(lastAverageDelta) > NEW_INPUT_DELTA_THRESHOLD;

    scheduleResetActiveScroll(ACTIVE_SCROLL_RESET_TIMEOUT);

    // If we're at the top and scrolling up
    if (scrollTop === 0 && deltaY < 0 && state !== 'overscroll') {
      if (!activeScroll.resetStartTopAt) {
        // Schedule delta reset, so we would respond to new input with `isStartedAtTop` flag set
        activeScroll.resetStartTopAt = Date.now() + ACTIVE_SCROLL_RESET_TIMEOUT;
      }

      // Only trigger overscroll on new input, ignore momentum events
      if (isNewInput && activeScroll.isStartedAtTop) {
        triggerOverscroll();
      }
      return;
    }

    // Ignore scroll events during collapse animation
    if (state === 'animating' && deltaY > 0) {
      stopEvent(e);
      return;
    }

    // If we're overscrolled, any down wheel event should reset
    if (state === 'overscroll' && deltaY > 0) {
      triggerReset();
      stopEvent(e);
      return;
    }
  });

  const handleTouchStart = useLastCallback((e: TouchEvent) => {
    const container = containerRef.current;
    if (!container || e.touches.length !== 1) return;

    const { scrollTop } = container;
    const state = getState();

    // Register touch start position when at top or in overscroll state
    if (scrollTop === 0 || state === 'overscroll') {
      touchStartYRef.current = e.touches[0].clientY;
    }
  });

  const handleTouchMove = useLastCallback((e: TouchEvent) => {
    const container = containerRef.current;
    const startY = touchStartYRef.current;
    if (!container || startY === undefined || e.touches.length !== 1) return;

    const { scrollTop } = container;
    const state = getState();
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;

    if (state === 'animating') {
      return;
    }

    // If we're at the top and dragging down by more than trigger distance
    if (scrollTop === 0 && deltaY > DRAG_TRIGGER_DISTANCE && state !== 'overscroll') {
      triggerOverscroll();
      touchStartYRef.current = undefined; // Reset to prevent multiple triggers
      return;
    }

    // If we're overscrolled and dragging up by more than trigger distance, reset
    if (state === 'overscroll' && deltaY < -DRAG_TRIGGER_DISTANCE) {
      triggerReset();
      touchStartYRef.current = undefined; // Reset to prevent multiple triggers
      return;
    }
  });

  const handleTouchEnd = useLastCallback(() => {
    touchStartYRef.current = undefined;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (isDisabled || !container) return;
    requestMutation(() => {
      container.classList.add(OVERSCROLL_CONTAINER_CLASS);
    });

    return () => {
      requestMutation(() => {
        container.classList.remove(OVERSCROLL_CONTAINER_CLASS);
      });
    };
  }, [containerRef, isDisabled]);

  useEffect(() => {
    const container = containerRef.current;
    if (isDisabled || !container) return;
    requestMutation(() => {
      container.classList.toggle(NO_TOUCH_CONTAINER_CLASS, getState() !== 'normal');
    });

    return () => {
      requestMutation(() => {
        container.classList.remove(NO_TOUCH_CONTAINER_CLASS);
      });
    };
  }, [containerRef, isDisabled, getState]);

  useEffect(() => {
    if (!isOverscrolled && getState() === 'animating') {
      return; // We're animating towards this state
    }

    setState(isOverscrolled ? 'overscroll' : 'normal');
  }, [isOverscrolled, getState, setState]);

  useEffect(() => {
    const container = containerRef.current;
    if (isDisabled || !container) {
      return undefined;
    }

    container.addEventListener('wheel', handleWheel, { passive: getState() === 'normal' });
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);

      const activeScroll = activeScrollRef.current;
      if (activeScroll?.timeout) clearTimeout(activeScroll.timeout);
    };
  }, [containerRef, handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd, getState, isDisabled]);
}
