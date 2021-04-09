import { fastRaf } from './schedulers';
import { animate } from './animation';
import { IS_IOS } from './environment';

const DURATION = 450;

export default function fastSmoothScroll(container: HTMLElement, left: number) {
  // Native way seems to be smoother in Chrome
  if (!IS_IOS) {
    container.scrollTo({ left, behavior: 'smooth' });
  } else {
    fastRaf(() => {
      scrollWithJs(container, left);
    });
  }
}

function scrollWithJs(container: HTMLElement, left: number) {
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
  const startAt = Date.now();

  animate(() => {
    const t = Math.min((Date.now() - startAt) / DURATION, 1);

    const currentPath = path * (1 - transition(t));
    container.scrollLeft = Math.round(target - currentPath);

    return t < 1;
  });
}

function transition(t: number) {
  return 1 - ((1 - t) ** 3.5);
}
