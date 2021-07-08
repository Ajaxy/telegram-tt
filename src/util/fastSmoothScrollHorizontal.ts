import { getGlobal } from '../lib/teact/teactn';

import { fastRaf } from './schedulers';
import { animate } from './animation';
import { IS_IOS } from './environment';
import { ANIMATION_LEVEL_MIN } from '../config';

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
    fastRaf(() => {
      scrollWithJs(container, left, duration);
    });
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

  const target = container.scrollLeft + path;

  if (duration === 0) {
    container.scrollTop = target;
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
