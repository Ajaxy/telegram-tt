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
import {
  addExtraClass, removeExtraClass, setExtraStyles, toggleExtraClass,
} from '../../../lib/teact/teact-dom';

import {
  getPhase, requestForcedReflow, requestMutation, requestNextMutation,
} from '../../../lib/fasterdom/fasterdom';
import { REM } from '../../common/helpers/mediaDimensions';

import useTimeout from '../../../hooks/schedulers/useTimeout';
import useLastCallback from '../../../hooks/useLastCallback';
import useResizeObserver from '../../../hooks/useResizeObserver';
import useThrottledCallback from '../../../hooks/useThrottledCallback';

export interface PaneState {
  element?: HTMLElement;
  height: number;
  isOpen?: boolean;
  isSpacer?: boolean;
  isPending?: boolean;
  key?: string;
}

// Max slide transition duration
const CLOSE_DURATION = 450;
const RESIZE_THROTTLE = 100;
const ROW_ANIMATION_SUPPRESS_MS = 450;
export const PANE_GAP_REM = 0.5;

export default function useHeaderPane<RefType extends HTMLElement = HTMLDivElement>({
  ref: providedRef,
  isOpen,
  isPending,
  isDisabled,
  withResizeObserver,
  measureKey,
  onStateChange,
}: {
  ref?: ElementRef<RefType>;
  isOpen?: boolean;
  isPending?: boolean;
  isDisabled?: boolean;
  withResizeObserver?: boolean;
  measureKey?: string;
  onStateChange?: (state: PaneState) => void;
}) {
  const [shouldRenderTail, setShouldRenderTail] = useState(isOpen);
  const shouldRender = (isOpen && !isDisabled) || shouldRenderTail;
  const localRef = useRef<RefType>();
  const ref = providedRef || localRef;

  const lastHeightRef = useRef(0);

  const reset = useLastCallback(() => {
    setShouldRenderTail(true);
    onStateChange?.({
      element: undefined,
      height: 0,
      isOpen: false,
      key: measureKey,
    });
  });

  useEffect(() => {
    if (isDisabled) {
      reset();
    }
  }, [isDisabled]);

  useEffect(() => {
    if (isOpen) {
      setShouldRenderTail(true);
    }
  }, [isOpen]);

  useUnmountCleanup(reset);

  useTimeout(() => {
    if (isOpen) return;
    setShouldRenderTail(false);
    onStateChange?.({
      height: 0,
      isOpen: false,
      isPending,
      key: measureKey,
    });
  }, !isOpen ? CLOSE_DURATION : undefined);

  // Should be `useCallback` to trigger effect on deps change
  const handleUpdate = useCallback(() => {
    if (isDisabled) return;
    const element = ref.current;

    if (!isOpen) {
      onStateChange?.({
        element,
        height: 0,
        isOpen: false,
        isPending,
        key: measureKey,
      });
      return;
    }
    if (!element || !shouldRender) return;

    requestForcedReflow(() => {
      const currentHeight = element.offsetHeight;
      lastHeightRef.current = currentHeight;
      return () => {
        onStateChange?.({
          element,
          height: currentHeight,
          isOpen,
          key: measureKey,
        });
      };
    });
  }, [isOpen, isPending, shouldRender, isDisabled, ref, onStateChange, measureKey]);

  const handleResize = useThrottledCallback(() => {
    const element = ref.current;
    if (!element) return;

    const newHeight = element.offsetHeight;
    if (newHeight === lastHeightRef.current) {
      return;
    }

    handleUpdate();
  }, [handleUpdate, ref], RESIZE_THROTTLE, true);

  useLayoutEffect(handleUpdate, [handleUpdate, measureKey]);

  useResizeObserver(ref, handleResize, !withResizeObserver || !shouldRender);

  return {
    shouldRender,
    ref,
  };
}

export function commitInMutatePhase(cb: NoneToVoidFunction) {
  if (getPhase() === 'mutate') {
    cb();
  } else {
    requestMutation(cb);
  }
}

let placementCounter = 0;

export function applyAnimationState({
  list,
  noTransition = false,
  snapEntrancesOnly = false,
  gapPx = PANE_GAP_REM * REM,
}: {
  list: PaneState[];
  noTransition?: boolean;
  snapEntrancesOnly?: boolean;
  gapPx?: number;
}) {
  let cumulativeHeight = 0;
  for (let i = 0; i < list.length; i++) {
    const state = list[i];
    const element = state.element;
    if (!element) {
      if (state.isSpacer) cumulativeHeight += state.height;
      continue;
    }

    const shiftPx = `${cumulativeHeight}px`;

    const isEntrance = !element.dataset.isPanelOpen && state.isOpen && !noTransition;

    const token = String(++placementCounter);
    element.dataset.placementToken = token;

    const apply = () => {
      setExtraStyles(element, {
        transform: `translateY(${state.isOpen ? shiftPx : `calc(${shiftPx} - 100% - ${gapPx}px)`})`,
        opacity: '1',
        zIndex: String(-i),
        transition: noTransition ? 'none' : '',
      });
    };

    const applyDeferred = () => {
      if (element.dataset.placementToken !== token) return;
      apply();
    };

    if (isEntrance && snapEntrancesOnly) {
      setExtraStyles(element, {
        transform: `translateY(${shiftPx})`,
        opacity: '1',
        zIndex: String(-i),
        transition: 'none',
      });
      element.dataset.isPanelOpen = 'true';
    } else if (isEntrance) {
      setExtraStyles(element, {
        transform: `translateY(calc(${shiftPx} - 100%))`,
        opacity: '1',
        zIndex: String(-i),
        transition: 'none',
      });
      element.dataset.isPanelOpen = 'true';
      requestNextMutation(applyDeferred);
    } else if (state.isOpen) {
      element.dataset.isPanelOpen = 'true';
      apply();
    } else {
      delete element.dataset.isPanelOpen;
      apply();
    }

    cumulativeHeight += state.height;
    if (state.height > 0) cumulativeHeight += gapPx;
  }
}

export function transitionIslandVisual({
  container,
  toHeight,
  shouldGlide,
  hiddenClassName,
  suppressRowAnimationsUntilRef,
  noAutoUnhide,
  noFade,
  isCanceled,
}: {
  container: HTMLElement;
  toHeight: number;
  shouldGlide: boolean;
  hiddenClassName: string;
  suppressRowAnimationsUntilRef?: { current: number };
  noAutoUnhide?: boolean;
  noFade?: boolean;
  isCanceled?: () => boolean;
}) {
  const isHiddenNow = container.classList.contains(hiddenClassName);
  if (toHeight === 0) {
    setExtraStyles(container, { '--island-height-transition': '0s' });
    if (noFade) {
      toggleIslandHiddenInstantly(container, hiddenClassName, true);
    } else {
      addExtraClass(container, hiddenClassName);
    }
  } else if (isHiddenNow) {
    if (suppressRowAnimationsUntilRef) {
      suppressRowAnimationsUntilRef.current = performance.now() + ROW_ANIMATION_SUPPRESS_MS;
    }
    setExtraStyles(container, {
      '--island-height-transition': '0s',
      height: `${toHeight}px`,
    });
    if (!noAutoUnhide) {
      if (noFade) {
        toggleIslandHiddenInstantly(container, hiddenClassName, false);
      } else {
        requestNextMutation(() => {
          if (isCanceled?.()) return;
          removeExtraClass(container, hiddenClassName);
        });
      }
    }
  } else {
    setExtraStyles(container, {
      '--island-height-transition': shouldGlide ? 'var(--slide-transition)' : '0s',
      height: `${toHeight}px`,
    });
  }
}
export function toggleIslandHiddenInstantly(container: HTMLElement, hiddenClassName: string, isHidden: boolean) {
  setExtraStyles(container, { transition: 'none' });
  toggleExtraClass(container, hiddenClassName, isHidden);
  requestForcedReflow(() => {
    void container.offsetWidth;
    return () => {
      setExtraStyles(container, { transition: '' });
    };
  });
}
