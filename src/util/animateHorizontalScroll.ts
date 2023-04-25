import { getGlobal } from '../global';

import { animate } from './animation';
import { requestMutation } from '../lib/fasterdom/fasterdom';
import { selectCanAnimateInterface } from '../global/selectors';

const DEFAULT_DURATION = 300;

const stopById: Map<string, VoidFunction> = new Map();

export default function animateHorizontalScroll(container: HTMLElement, left: number, duration = DEFAULT_DURATION) {
  if (!selectCanAnimateInterface(getGlobal())) {
    duration = 0;
  }

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

  return new Promise<void>((resolve) => {
    requestMutation(() => {
      if (duration === 0) {
        container.scrollLeft = target;
        resolve();
        return;
      }

      let isStopped = false;
      const id = Math.random().toString();
      container.dataset.scrollId = id;
      stopById.set(id, () => {
        isStopped = true;
      });

      container.style.scrollSnapType = 'none';

      const startAt = Date.now();

      animate(() => {
        if (isStopped) return false;

        const t = Math.min((Date.now() - startAt) / duration, 1);

        const currentPath = path * (1 - transition(t));
        container.scrollLeft = Math.round(target - currentPath);

        if (t >= 1) {
          container.style.scrollSnapType = '';
          delete container.dataset.scrollId;
          stopById.delete(id);
          resolve();
        }

        return t < 1;
      }, requestMutation);
    });
  });
}

function transition(t: number) {
  return 1 - ((1 - t) ** 3.5);
}
