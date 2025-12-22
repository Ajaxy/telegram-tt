import type {
  ElementRef } from '../../../lib/teact/teact';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useUnmountCleanup,
} from '../../../lib/teact/teact';
import { setExtraStyles } from '../../../lib/teact/teact-dom';

import { requestForcedReflow, requestNextMutation } from '../../../lib/fasterdom/fasterdom';

import useTimeout from '../../../hooks/schedulers/useTimeout';
import useLastCallback from '../../../hooks/useLastCallback';
import useResizeObserver from '../../../hooks/useResizeObserver';
import useThrottledCallback from '../../../hooks/useThrottledCallback';

export interface PaneState {
  element?: HTMLElement;
  height: number;
  isOpen?: boolean;
}

// Max slide transition duration
const CLOSE_DURATION = 450;
const RESIZE_THROTTLE = 100;

export default function useHeaderPane<RefType extends HTMLElement = HTMLDivElement>({
  ref: providedRef,
  isOpen,
  isDisabled,
  withResizeObserver,
  onStateChange,
}: {
  ref?: ElementRef<RefType>;
  isOpen?: boolean;
  isDisabled?: boolean;
  withResizeObserver?: boolean;
  onStateChange?: (state: PaneState) => void;
}) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const localRef = useRef<RefType>();
  const ref = providedRef || localRef;

  const lastHeightRef = useRef(0);

  const reset = useLastCallback(() => {
    setShouldRender(true);
    onStateChange?.({
      element: undefined,
      height: 0,
      isOpen: false,
    });
  });

  useEffect(() => {
    if (isDisabled) {
      reset();
    }
  }, [isDisabled]);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    }
  }, [isOpen]);

  useUnmountCleanup(reset);

  useTimeout(() => {
    setShouldRender(false);
    onStateChange?.({
      height: 0,
      isOpen: false,
    });
  }, !isOpen ? CLOSE_DURATION : undefined);

  // Should be `useCallback` to trigger effect on deps change
  const handleUpdate = useCallback(() => {
    const element = ref.current;
    if (isDisabled || !element || !shouldRender) return;

    if (!isOpen) {
      onStateChange?.({
        element,
        height: 0,
        isOpen: false,
      });
      return;
    }

    requestForcedReflow(() => {
      const currentHeight = element.offsetHeight;
      lastHeightRef.current = currentHeight;
      return () => {
        onStateChange?.({
          element,
          height: currentHeight,
          isOpen,
        });
      };
    });
  }, [isOpen, shouldRender, isDisabled, ref, onStateChange]);

  const handleResize = useThrottledCallback(() => {
    const element = ref.current;
    if (!element) return;

    const newHeight = element.offsetHeight;
    if (newHeight === lastHeightRef.current) {
      return;
    }

    handleUpdate();
  }, [handleUpdate, ref], RESIZE_THROTTLE, true);

  useLayoutEffect(handleUpdate, [handleUpdate]);

  useResizeObserver(ref, handleResize, !withResizeObserver || !shouldRender);

  return {
    shouldRender,
    ref,
  };
}

export function applyAnimationState({
  list,
  noTransition = false,
  zIndexIncrease,
  topMargin = 0,
}: {
  list: PaneState[];
  noTransition?: boolean;
  zIndexIncrease?: boolean;
  topMargin?: number;
}) {
  let cumulativeHeight = 0;
  for (let i = 0; i < list.length; i++) {
    const state = list[i];
    const element = state.element;
    if (!element) {
      continue;
    }

    const shiftPx = `${cumulativeHeight}px`;

    const apply = () => {
      setExtraStyles(element, {
        transform: `translateY(${state.isOpen ? shiftPx : `calc(${shiftPx} - ${topMargin}px - 100%)`})`,
        zIndex: String(-i),
        transition: noTransition ? 'none' : '',
      });
    };

    if (!element.dataset.isPanelOpen && state.isOpen && !noTransition) {
      // Start animation right above its final position
      setExtraStyles(element, {
        transform: `translateY(calc(${shiftPx} - ${topMargin}px - 100%))`,
        zIndex: String(zIndexIncrease ? i : -i),
        transition: 'none',
      });
      element.dataset.isPanelOpen = 'true';
      requestNextMutation(apply);
    } else {
      apply();
    }

    cumulativeHeight += state.height;
  }
}
