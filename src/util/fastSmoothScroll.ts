import { getGlobal } from '../global';

import { FocusDirection } from '../types';

import {
  ANIMATION_LEVEL_MIN,
  FAST_SMOOTH_MIN_DURATION,
  FAST_SMOOTH_MAX_DURATION,
  FAST_SMOOTH_MAX_DISTANCE,
  FAST_SMOOTH_SHORT_TRANSITION_MAX_DISTANCE,
} from '../config';
import { IS_ANDROID } from './windowEnvironment';
import { dispatchHeavyAnimationEvent } from '../hooks/useHeavyAnimationCheck';
import { animateSingle } from './animation';
import { requestForcedReflow, requestMutation } from '../lib/fasterdom/fasterdom';

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
  withForcedReflow = false,
) {
  const args = [
    container,
    element,
    position,
    margin,
    maxDistance,
    forceDirection,
    forceDuration,
    forceNormalContainerHeight,
  ] as const;

  if (withForcedReflow) {
    requestForcedReflow(() => measure(...args));
  } else {
    requestMutation(measure(...args));
  }
}

function measure(
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
    || getGlobal().settings.byKey.animationLevel === ANIMATION_LEVEL_MIN
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

  if (currentScrollTop !== scrollFrom) {
    container.scrollTop = scrollFrom;
  }

  let path = scrollTo - scrollFrom;

  if (path < 0) {
    const remainingPath = -scrollFrom;
    path = Math.max(path, remainingPath);
  } else if (path > 0) {
    const remainingPath = scrollHeight - (scrollFrom + targetContainerHeight);
    path = Math.min(path, remainingPath);
  }

  return () => {
    if (currentScrollTop !== scrollFrom) {
      container.scrollTop = scrollFrom;
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

      container.scrollTop = Math.round(target - currentPath);

      isAnimating = t < 1;

      if (!isAnimating) {
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
  return 1 - ((1 - t) ** 3);
}

function longTransition(t: number) {
  return 1 - ((1 - t) ** 6.5);
}
