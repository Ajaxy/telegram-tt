import { setExtraStyles } from '@teact/teact-dom';
import { beginHeavyAnimation } from '../lib/teact/teact';
import { getGlobal } from '../global';

import type { ScrollTargetPosition } from '../types';
import { FocusDirection } from '../types';

import {
  SCROLL_MAX_DISTANCE,
  SCROLL_MAX_DURATION,
  SCROLL_MIN_DURATION,
  SCROLL_SHORT_TRANSITION_MAX_DISTANCE,
} from '../config';
import { requestMeasure, requestMutation } from '../lib/fasterdom/fasterdom';
import { selectCanAnimateInterface } from '../global/selectors';
import { IS_ANDROID } from './browser/windowEnvironment';
import getOffsetToContainer from './visibility/getOffsetToContainer';
import { animateSingle, cancelSingleAnimation } from './animation';

export type AnimateScrollArgs = {
  container: HTMLElement;
  element: HTMLElement;
  position: ScrollTargetPosition;
  margin?: number;
  topReserve?: number;
  bottomReserve?: number;
  maxDistance?: number;
  forceDirection?: FocusDirection;
  forceDuration?: number;
  forceNormalContainerHeight?: boolean;
  shouldReturnMutationFn?: boolean;
};

let isAnimating = false;
let currentArgs: AnimateScrollArgs | undefined;
let activeArgs: AnimateScrollArgs | undefined;
let onHeavyAnimationEnd: NoneToVoidFunction | undefined;

export default function animateScroll(args: AnimateScrollArgs) {
  currentArgs = args;
  const mutate = createMutateFunction(args);

  if (args.shouldReturnMutationFn) {
    return mutate;
  }

  requestMutation(mutate);
  return undefined;
}

export function restartCurrentScrollAnimation() {
  if (!isAnimating || !activeArgs) {
    return;
  }

  const args = activeArgs;

  requestMeasure(() => {
    if (!isAnimating || activeArgs !== args) {
      return;
    }

    cancelSingleAnimation();
    const mutate = createMutateFunction(args);
    requestMutation(() => {
      if (activeArgs !== args) {
        return;
      }
      mutate();
    });
  });
}

function createMutateFunction(args: AnimateScrollArgs) {
  const {
    container,
    element,
    position,
    margin = 0,
    topReserve = 0,
    bottomReserve = 0,
    maxDistance = SCROLL_MAX_DISTANCE,
    forceDirection,
    forceNormalContainerHeight,
  } = args;

  let forceDuration = args.forceDuration;

  if (
    forceDirection === FocusDirection.Static
    || !selectCanAnimateInterface(getGlobal())
  ) {
    forceDuration = 0;
  }

  const { offsetHeight: elementHeight } = element;
  const { scrollTop: currentScrollTop, clientHeight: containerHeight, scrollHeight } = container;
  const elementTop = getOffsetToContainer(element, container).top;

  const targetContainerHeight = forceNormalContainerHeight && container.dataset.normalHeight
    ? Number(container.dataset.normalHeight)
    : containerHeight;

  let scrollTo!: number;
  switch (position) {
    case 'start':
      scrollTo = (elementTop - margin) + (IS_ANDROID ? 1 : 0);
      break;
    case 'end':
      scrollTo = (elementTop + elementHeight + margin) - targetContainerHeight;
      break;
    // 'nearest' is not supported yet
    case 'nearest':
    case 'center':
    case 'centerOrTop': {
      const visibleHeight = Math.max(0, targetContainerHeight - topReserve - bottomReserve);
      scrollTo = elementHeight < visibleHeight
        ? (elementTop + elementHeight / 2 - topReserve - visibleHeight / 2)
        : (elementTop - margin);
      break;
    }
  }

  const scrollFrom = calculateScrollFrom(container, scrollTo, maxDistance, forceDirection);

  let path = scrollTo - scrollFrom;
  if (path < 0) {
    const remainingPath = -scrollFrom;
    path = Math.max(path, remainingPath);
  } else if (path > 0) {
    const remainingPath = scrollHeight - (scrollFrom + targetContainerHeight);
    path = Math.min(path, remainingPath);
  }

  const absPath = Math.abs(path);

  return () => {
    if (absPath < 1) {
      if (currentScrollTop !== scrollFrom) {
        container.scrollTop = scrollFrom;
      }

      if (isAnimating && activeArgs?.container === container) {
        cancelSingleAnimation();
        isAnimating = false;
        currentArgs = undefined;
        releaseAnimatingContainer(container);
        onHeavyAnimationEnd?.();
        onHeavyAnimationEnd = undefined;
      }

      return;
    }

    const target = scrollFrom + path;

    if (forceDuration === 0) {
      container.scrollTop = target;
      return;
    }

    const transition = absPath <= SCROLL_SHORT_TRANSITION_MAX_DISTANCE ? shortTransition : longTransition;
    const duration = forceDuration || (
      SCROLL_MIN_DURATION
      + (absPath / SCROLL_MAX_DISTANCE) * (SCROLL_MAX_DURATION - SCROLL_MIN_DURATION)
    );
    const startAt = Date.now();

    const activeContainer = activeArgs?.container;
    if (activeContainer && activeContainer !== container) {
      // The superseded animation's loop is cancelled by `animateSingle` below and never
      // runs its own cleanup — restore that container's snap before taking over
      setExtraStyles(activeContainer, {
        scrollSnapType: '',
      });
    }

    isAnimating = true;
    activeArgs = args;

    setExtraStyles(container, {
      scrollSnapType: 'none',
    });

    const prevOnHeavyAnimationEnd = onHeavyAnimationEnd;
    onHeavyAnimationEnd = beginHeavyAnimation(undefined, true);
    prevOnHeavyAnimationEnd?.();

    animateSingle(() => {
      const t = Math.min((Date.now() - startAt) / duration, 1);
      const currentPath = path * (1 - transition(t));
      const newScrollTop = Math.round(target - currentPath);

      container.scrollTop = newScrollTop;

      isAnimating = t < 1 && newScrollTop !== target;

      if (!isAnimating) {
        currentArgs = undefined;
        releaseAnimatingContainer(container);

        onHeavyAnimationEnd?.();
        onHeavyAnimationEnd = undefined;
      }

      return isAnimating;
    }, requestMutation);
  };
}

export function isAnimatingScroll(container?: HTMLElement) {
  if (!isAnimating) return false;
  return !container || activeArgs?.container === container;
}

export function cancelScrollBlockingAnimation() {
  if (isAnimating) {
    cancelSingleAnimation();
  }
  isAnimating = false;
  releaseAnimatingContainer(currentArgs?.container);
  currentArgs = undefined;

  onHeavyAnimationEnd?.();
  onHeavyAnimationEnd = undefined;
}

function releaseAnimatingContainer(fallbackContainer?: HTMLElement) {
  const container = activeArgs?.container ?? fallbackContainer;
  if (container) {
    setExtraStyles(container, {
      scrollSnapType: '',
    });
  }

  activeArgs = undefined;
}

function calculateScrollFrom(
  container: HTMLElement,
  scrollTo: number,
  maxDistance = SCROLL_MAX_DISTANCE,
  forceDirection?: FocusDirection,
) {
  const { scrollTop } = container;

  if (forceDirection === undefined) {
    const offset = scrollTo - scrollTop;

    if (offset < -maxDistance) {
      return scrollTop + (offset + maxDistance);
    } else if (offset > maxDistance) {
      return scrollTop + (offset - maxDistance);
    }
  } else if (forceDirection === FocusDirection.Up) {
    return scrollTo + maxDistance;
  } else if (forceDirection === FocusDirection.Down) {
    return Math.max(0, scrollTo - maxDistance);
  }

  return scrollTop;
}

function shortTransition(t: number) {
  return 1 - ((1 - t) ** 3.5);
}

function longTransition(t: number) {
  return 1 - ((1 - t) ** 6);
}
