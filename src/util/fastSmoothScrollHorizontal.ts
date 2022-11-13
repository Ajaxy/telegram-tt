import { getGlobal } from '../global';

import { ANIMATION_LEVEL_MIN } from '../config';
import { animate } from './animation';

const DEFAULT_DURATION = 300;

const stopById: Map<string, VoidFunction> = new Map();

export default function fastSmoothScrollHorizontal(container: HTMLElement, left: number, duration = DEFAULT_DURATION) {
  if (getGlobal().settings.byKey.animationLevel === ANIMATION_LEVEL_MIN) {
    duration = 0;
  }

  return scrollWithJs(container, left, duration);
}

function scrollWithJs(container: HTMLElement, left: number, duration: number) {
  const isRtl = container.getAttribute('dir') === 'rtl';
  const {
    scrollLeft, offsetWidth: containerWidth, scrollWidth, dataset: { scrollId },
  } = container;

  let path = left - scrollLeft;

  if (path < 0) {
    const remainingPath = -scrollLeft * (isRtl ? -1 : 1);
    path = Math.max(path, remainingPath);
  } else if (path > 0) {
    const remainingPath = scrollWidth - (scrollLeft + containerWidth);
    path = Math.min(path, remainingPath);
  }

  if (path === 0) {
    return Promise.resolve();
  }

  if (scrollId && stopById.has(scrollId)) {
    stopById.get(scrollId)!();
  }

  const target = scrollLeft + path;

  if (duration === 0) {
    container.scrollLeft = target;
    return Promise.resolve();
  }

  let isStopped = false;
  const id = Math.random().toString();
  container.dataset.scrollId = id;
  stopById.set(id, () => {
    isStopped = true;
  });

  container.style.scrollSnapType = 'none';

  let resolve: VoidFunction;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  const startAt = Date.now();

  animate(() => {
    if (isStopped) return false;

    const t = Math.min((Date.now() - startAt) / duration, 1);

    const currentPath = path * (1 - transition(t));
    container.scrollLeft = Math.round(target - currentPath);

    if (t >= 1) {
      container.style.scrollSnapType = '';
      container.dataset.scrollId = undefined;
      stopById.delete(id);
      resolve();
    }
    return t < 1;
  });

  return promise;
}

function transition(t: number) {
  return 1 - ((1 - t) ** 3.5);
}
