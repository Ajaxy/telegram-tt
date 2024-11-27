import {
  type RefObject,
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

export interface PaneState {
  element?: HTMLElement;
  height: number;
  isOpen?: boolean;
}

// Max slide transition duration
const CLOSE_DURATION = 450;

export default function useHeaderPane<RefType extends HTMLElement = HTMLDivElement>({
  ref: providedRef,
  isOpen,
  isDisabled,
  onStateChange,
} : {
  ref?: RefObject<RefType | null>;
  isOpen?: boolean;
  isDisabled?: boolean;
  onStateChange?: (state: PaneState) => void;
}) {
  const [shouldRender, setShouldRender] = useState(true);
  // eslint-disable-next-line no-null/no-null
  const localRef = useRef<RefType>(null);
  const ref = providedRef || localRef;

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
  }, !isOpen ? CLOSE_DURATION : undefined);

  useLayoutEffect(() => {
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
      return () => {
        onStateChange?.({
          element,
          height: currentHeight,
          isOpen,
        });
      };
    });
  }, [isOpen, shouldRender, isDisabled, ref, onStateChange]);

  return {
    shouldRender,
    ref,
  };
}

export function applyAnimationState(list: PaneState[], noTransition = false) {
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
        transform: `translateY(${state.isOpen ? shiftPx : `calc(${shiftPx} - 100%)`})`,
        zIndex: String(-i),
        transition: noTransition ? 'none' : '',
      });
    };

    if (!element.dataset.isPanelOpen && state.isOpen && !noTransition) {
      // Start animation right above its final position
      setExtraStyles(element, {
        transform: `translateY(calc(${shiftPx} - 100%))`,
        zIndex: String(-i),
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
