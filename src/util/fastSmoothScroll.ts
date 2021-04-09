import { FocusDirection } from '../types';

import { dispatchHeavyAnimationEvent } from '../hooks/useHeavyAnimationCheck';
import { fastRaf } from './schedulers';
import { animateSingle } from './animation';

const MAX_DISTANCE = 1500;
const MIN_JS_DURATION = 250;
const MAX_JS_DURATION = 600;

export default function fastSmoothScroll(
  container: HTMLElement,
  element: HTMLElement,
  position: ScrollLogicalPosition,
  margin = 0,
  maxDistance = MAX_DISTANCE,
  forceDirection?: FocusDirection,
  forceDuration?: number,
) {
  if (forceDirection === FocusDirection.Static) {
    element.scrollIntoView({ block: position });

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

  fastRaf(() => {
    dispatchHeavyAnimationEvent(MAX_JS_DURATION);
    scrollWithJs(container, element, position, margin, forceDuration);
  });
}

function scrollWithJs(
  container: HTMLElement, element: HTMLElement, position: ScrollLogicalPosition, margin = 0, forceDuration?: number,
) {
  const { offsetTop: elementTop, offsetHeight: elementHeight } = element;
  const { scrollTop, offsetHeight: containerHeight, scrollHeight } = container;
  let path!: number;

  switch (position) {
    case 'start':
      path = (elementTop - margin) - scrollTop;
      break;
    case 'end':
      path = (elementTop + elementHeight + margin) - (scrollTop + containerHeight);
      break;
    // 'nearest' is not supported yet
    case 'nearest':
    case 'center':
      path = elementHeight < containerHeight
        ? (elementTop + elementHeight / 2) - (scrollTop + containerHeight / 2)
        : (elementTop - margin) - scrollTop;
      break;
  }

  if (path < 0) {
    const remainingPath = -scrollTop;
    path = Math.max(path, remainingPath);
  } else if (path > 0) {
    const remainingPath = scrollHeight - (scrollTop + containerHeight);
    path = Math.min(path, remainingPath);
  }

  const target = container.scrollTop + path;
  const duration = forceDuration || (
    MIN_JS_DURATION + (Math.abs(path) / MAX_DISTANCE) * (MAX_JS_DURATION - MIN_JS_DURATION)
  );
  const startAt = Date.now();

  animateSingle(() => {
    const t = Math.min((Date.now() - startAt) / duration, 1);

    const currentPath = path * (1 - transition(t));
    container.scrollTop = Math.round(target - currentPath);

    return t < 1;
  });
}

function transition(t: number) {
  return 1 - ((1 - t) ** 3.5);
}
