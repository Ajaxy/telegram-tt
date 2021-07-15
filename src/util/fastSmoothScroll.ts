import { getGlobal } from '../lib/teact/teactn';

import { FocusDirection } from '../types';

import {
  ANIMATION_LEVEL_MIN,
  FAST_SMOOTH_MAX_DISTANCE, FAST_SMOOTH_MAX_DURATION, FAST_SMOOTH_MIN_DURATION,
  FAST_SMOOTH_SHORT_TRANSITION_MAX_DISTANCE,
} from '../config';
import { dispatchHeavyAnimationEvent } from '../hooks/useHeavyAnimationCheck';
import { fastRaf } from './schedulers';
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
  forceCurrentContainerHeight?: boolean,
) {
  if (forceDirection === FocusDirection.Static) {
    let block!: ScrollLogicalPosition;

    if (position === 'centerOrTop') {
      block = element.offsetHeight < container.offsetHeight ? 'center' : 'start';
    } else {
      block = position;
    }

    element.scrollIntoView({ block });

    return;
  }

  const { offsetTop } = element;

  if (forceDirection === undefined) {
    const offset = offsetTop - container.scrollTop;

    if (offset < -maxDistance) {
      container.scrollTop += (offset + maxDistance);
    } else if (offset > maxDistance) {
      container.scrollTop += (offset - maxDistance);
    }
  } else if (forceDirection === FocusDirection.Up) {
    container.scrollTop = offsetTop + maxDistance;
  } else if (forceDirection === FocusDirection.Down) {
    container.scrollTop = Math.max(0, offsetTop - maxDistance);
  }

  if (getGlobal().settings.byKey.animationLevel === ANIMATION_LEVEL_MIN) {
    forceDuration = 0;
  }

  isAnimating = true;
  fastRaf(() => {
    scrollWithJs(container, element, position, margin, forceDuration, forceCurrentContainerHeight);
  });
}

export function isAnimatingScroll() {
  return isAnimating;
}

function scrollWithJs(
  container: HTMLElement,
  element: HTMLElement,
  position: ScrollLogicalPosition | 'centerOrTop',
  margin = 0,
  forceDuration?: number,
  forceCurrentContainerHeight?: boolean,
) {
  const { offsetTop: elementTop, offsetHeight: elementHeight } = element;
  const { scrollTop, offsetHeight: containerHeight, scrollHeight } = container;
  const targetContainerHeight = !forceCurrentContainerHeight && container.dataset.normalHeight
    ? Number(container.dataset.normalHeight)
    : containerHeight;

  let path!: number;

  switch (position) {
    case 'start':
      path = (elementTop - margin) - scrollTop;
      break;
    case 'end':
      path = (elementTop + elementHeight + margin) - (scrollTop + targetContainerHeight);
      break;
    // 'nearest' is not supported yet
    case 'nearest':
    case 'center':
    case 'centerOrTop':
      path = elementHeight < targetContainerHeight
        ? (elementTop + elementHeight / 2) - (scrollTop + targetContainerHeight / 2)
        : (elementTop - margin) - scrollTop;
      break;
  }

  if (path < 0) {
    const remainingPath = -scrollTop;
    path = Math.max(path, remainingPath);
  } else if (path > 0) {
    const remainingPath = scrollHeight - (scrollTop + targetContainerHeight);
    path = Math.min(path, remainingPath);
  }

  if (path === 0) {
    isAnimating = false;

    return;
  }

  const target = container.scrollTop + path;

  if (forceDuration === 0) {
    container.scrollTop = target;
    isAnimating = false;

    return;
  }

  const absPath = Math.abs(path);
  const transition = absPath < FAST_SMOOTH_SHORT_TRANSITION_MAX_DISTANCE ? shortTransition : longTransition;
  const duration = forceDuration || (
    FAST_SMOOTH_MIN_DURATION
    + (absPath / FAST_SMOOTH_MAX_DISTANCE) * (FAST_SMOOTH_MAX_DURATION - FAST_SMOOTH_MIN_DURATION)
  );
  const startAt = Date.now();

  dispatchHeavyAnimationEvent(duration);
  animateSingle(() => {
    const t = Math.min((Date.now() - startAt) / duration, 1);

    const currentPath = path * (1 - transition(t));
    container.scrollTop = Math.round(target - currentPath);

    isAnimating = t < 1;

    return isAnimating;
  });
}

function longTransition(t: number) {
  return 1 - ((1 - t) ** 5);
}

function shortTransition(t: number) {
  return 1 - ((1 - t) ** 3.5);
}
