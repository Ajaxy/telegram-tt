import { getGlobal } from '../lib/teact/teactn';

import { ANIMATION_LEVEL_MIN } from '../config';
import { IS_IOS } from './environment';
import { animate } from './animation';

const DEFAULT_DURATION = 300;

export default function fastSmoothScrollHorizontal(container: HTMLElement, left: number, duration = DEFAULT_DURATION) {
  if (getGlobal().settings.byKey.animationLevel === ANIMATION_LEVEL_MIN) {
    duration = 0;
  }

  // Native way seems to be smoother in Chrome
  if (!IS_IOS) {
    container.scrollTo({
      left,
      ...(duration && { behavior: 'smooth' }),
    });
  } else {
    scrollWithJs(container, left, duration);
  }
}

function scrollWithJs(container: HTMLElement, left: number, duration: number) {
  const { scrollLeft, offsetWidth: containerWidth, scrollWidth } = container;
  let path = left - scrollLeft;

  if (path < 0) {
    const remainingPath = -scrollLeft;
    path = Math.max(path, remainingPath);
  } else if (path > 0) {
    const remainingPath = scrollWidth - (scrollLeft + containerWidth);
    path = Math.min(path, remainingPath);
  }

  if (path === 0) {
    return;
  }

  const target = scrollLeft + path;

  if (duration === 0) {
    container.scrollLeft = target;
    return;
  }

  const startAt = Date.now();

  animate(() => {
    const t = Math.min((Date.now() - startAt) / duration, 1);

    const currentPath = path * (1 - transition(t));
    container.scrollLeft = Math.round(target - currentPath);

    return t < 1;
  });
}

function transition(t: number) {
  return 1 - ((1 - t) ** 3.5);
}
