import { getGlobal } from '../global';

import { FocusDirection } from '../types';

import {
  FAST_SMOOTH_MAX_DISTANCE,
  FAST_SMOOTH_MAX_DURATION,
  FAST_SMOOTH_MIN_DURATION,
  FAST_SMOOTH_SHORT_TRANSITION_MAX_DISTANCE,
} from '../config';
import { requestMeasure, requestMutation } from '../lib/fasterdom/fasterdom';
import { selectCanAnimateInterface } from '../global/selectors';
import { animateSingle, cancelSingleAnimation } from './animation';
import { IS_ANDROID } from './windowEnvironment';

import { dispatchHeavyAnimationEvent } from '../hooks/useHeavyAnimationCheck';

type Params = Parameters<typeof createMutateFunction>;

let isAnimating = false;
let currentArgs: Parameters<typeof createMutateFunction> | undefined;

export default function animateScroll(...args: Params | [...Params, boolean]) {
  currentArgs = args.slice(0, 8) as Params;

  const mutate = createMutateFunction(...currentArgs);

  const shouldReturnMutationFn = args[8];
  if (shouldReturnMutationFn) {
    return mutate;
  }

  requestMutation(mutate);
  return undefined;
}

export function restartCurrentScrollAnimation() {
  if (!isAnimating) {
    return;
  }

  cancelSingleAnimation();

  requestMeasure(() => {
    requestMutation(createMutateFunction(...currentArgs!));
  });
}

function createMutateFunction(
  container: HTMLElement,
  element: HTMLElement,
  position: ScrollLogicalPosition | 'centerOrTop',
  margin = 0,
  maxDistance = FAST_SMOOTH_MAX_DISTANCE,
  forceDirection?: FocusDirection,
  forceDuration?: number,
  forceNormalContainerHeight?: boolean,
) {
  if (
    forceDirection === FocusDirection.Static
    || !selectCanAnimateInterface(getGlobal())
  ) {
    forceDuration = 0;
  }

  const { offsetTop: elementTop, offsetHeight: elementHeight } = element;
  const { scrollTop: currentScrollTop, offsetHeight: containerHeight, scrollHeight } = container;
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
    case 'centerOrTop':
      scrollTo = elementHeight < targetContainerHeight
        ? (elementTop + elementHeight / 2 - targetContainerHeight / 2)
        : (elementTop - margin);
      break;
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

      return;
    }

    const target = scrollFrom + path;

    if (forceDuration === 0) {
      container.scrollTop = target;
      return;
    }

    isAnimating = true;

    const transition = absPath <= FAST_SMOOTH_SHORT_TRANSITION_MAX_DISTANCE ? shortTransition : longTransition;
    const duration = forceDuration || (
      FAST_SMOOTH_MIN_DURATION
      + (absPath / FAST_SMOOTH_MAX_DISTANCE) * (FAST_SMOOTH_MAX_DURATION - FAST_SMOOTH_MIN_DURATION)
    );
    const startAt = Date.now();
    const onHeavyAnimationStop = dispatchHeavyAnimationEvent();

    animateSingle(() => {
      const t = Math.min((Date.now() - startAt) / duration, 1);
      const currentPath = path * (1 - transition(t));
      const newScrollTop = Math.round(target - currentPath);

      container.scrollTop = newScrollTop;

      isAnimating = t < 1 && newScrollTop !== target;

      if (!isAnimating) {
        currentArgs = undefined;
        onHeavyAnimationStop();
      }

      return isAnimating;
    }, requestMutation);
  };
}

export function isAnimatingScroll() {
  return isAnimating;
}

function calculateScrollFrom(
  container: HTMLElement,
  scrollTo: number,
  maxDistance = FAST_SMOOTH_MAX_DISTANCE,
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
  return 1 - ((1 - t) ** 6.5);
}
