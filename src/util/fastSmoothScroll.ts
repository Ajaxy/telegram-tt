import { getGlobal } from '../lib/teact/teactn';

import { FocusDirection } from '../types';

import {
  ANIMATION_LEVEL_MIN,
  FAST_SMOOTH_MAX_DISTANCE, FAST_SMOOTH_MAX_DURATION, FAST_SMOOTH_MIN_DURATION,
  FAST_SMOOTH_SHORT_TRANSITION_MAX_DISTANCE,
} from '../config';
import { dispatchHeavyAnimationEvent } from '../hooks/useHeavyAnimationCheck';
import { animateSingle } from './animation';

let isAnimating = false;

export default function fastSmoothScroll(
  container: HTMLElement,
  element: HTMLElement,
  position: ScrollLogicalPosition | 'centerOrTop',
  margin = 0,
  maxDistance = FAST_SMOOTH_MAX_DISTANCE,
  forceDirection?: FocusDirection,
  forceDuration?: number,
  forceNormalContainerHeight?: boolean,
) {
  const scrollFrom = calculateScrollFrom(container, element, maxDistance, forceDirection);

  if (forceDirection === FocusDirection.Static) {
    scrollWithJs(container, element, scrollFrom, position, margin, 0);
    return;
  }

  if (getGlobal().settings.byKey.animationLevel === ANIMATION_LEVEL_MIN) {
    forceDuration = 0;
  }

  scrollWithJs(container, element, scrollFrom, position, margin, forceDuration, forceNormalContainerHeight);
}

export function isAnimatingScroll() {
  return isAnimating;
}

function calculateScrollFrom(
  container: HTMLElement,
  element: HTMLElement,
  maxDistance = FAST_SMOOTH_MAX_DISTANCE,
  forceDirection?: FocusDirection,
) {
  const { offsetTop: elementTop } = element;
  const { scrollTop } = container;

  if (forceDirection === undefined) {
    const offset = elementTop - container.scrollTop;

    if (offset < -maxDistance) {
      return scrollTop + (offset + maxDistance);
    } else if (offset > maxDistance) {
      return scrollTop + (offset - maxDistance);
    }
  } else if (forceDirection === FocusDirection.Up) {
    return elementTop + maxDistance;
  } else if (forceDirection === FocusDirection.Down) {
    return Math.max(0, elementTop - maxDistance);
  }

  return scrollTop;
}

function scrollWithJs(
  container: HTMLElement,
  element: HTMLElement,
  scrollFrom: number,
  position: ScrollLogicalPosition | 'centerOrTop',
  margin = 0,
  forceDuration?: number,
  forceNormalContainerHeight?: boolean,
) {
  const { offsetTop: elementTop, offsetHeight: elementHeight } = element;
  const { scrollTop: currentScrollTop, offsetHeight: containerHeight, scrollHeight } = container;
  const targetContainerHeight = forceNormalContainerHeight && container.dataset.normalHeight
    ? Number(container.dataset.normalHeight)
    : containerHeight;

  if (currentScrollTop !== scrollFrom) {
    container.scrollTop = scrollFrom;
  }

  let path!: number;

  switch (position) {
    case 'start':
      path = (elementTop - margin) - scrollFrom;
      break;
    case 'end':
      path = (elementTop + elementHeight + margin) - (scrollFrom + targetContainerHeight);
      break;
    // 'nearest' is not supported yet
    case 'nearest':
    case 'center':
    case 'centerOrTop':
      path = elementHeight < targetContainerHeight
        ? (elementTop + elementHeight / 2) - (scrollFrom + targetContainerHeight / 2)
        : (elementTop - margin) - scrollFrom;
      break;
  }

  if (path < 0) {
    const remainingPath = -scrollFrom;
    path = Math.max(path, remainingPath);
  } else if (path > 0) {
    const remainingPath = scrollHeight - (scrollFrom + targetContainerHeight);
    path = Math.min(path, remainingPath);
  }

  if (path === 0) {
    return;
  }

  const target = scrollFrom + path;

  if (forceDuration === 0) {
    container.scrollTop = target;
    return;
  }

  isAnimating = true;

  const absPath = Math.abs(path);
  const transition = absPath < FAST_SMOOTH_SHORT_TRANSITION_MAX_DISTANCE ? shortTransition : longTransition;
  const duration = forceDuration || (
    FAST_SMOOTH_MIN_DURATION
    + (absPath / FAST_SMOOTH_MAX_DISTANCE) * (FAST_SMOOTH_MAX_DURATION - FAST_SMOOTH_MIN_DURATION)
  );
  const startAt = Date.now();
  const onHeavyAnimationStop = dispatchHeavyAnimationEvent();

  animateSingle(() => {
    const t = Math.min((Date.now() - startAt) / duration, 1);
    const currentPath = path * (1 - transition(t));

    container.scrollTop = Math.round(target - currentPath);

    isAnimating = t < 1;

    if (!isAnimating) {
      onHeavyAnimationStop();
    }

    return isAnimating;
  });
}

function longTransition(t: number) {
  return 1 - ((1 - t) ** 5);
}

function shortTransition(t: number) {
  return 1 - ((1 - t) ** 3.5);
}
