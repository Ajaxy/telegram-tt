import { IS_IOS } from './environment';
import forceReflow from './forceReflow';

export default (container: HTMLDivElement, scrollTop?: number) => {
  if (IS_IOS) {
    container.style.overflow = 'hidden';
  }

  if (scrollTop !== undefined) {
    container.scrollTop = scrollTop;
  }

  if (IS_IOS) {
    container.style.overflow = '';
  }
};

// Workaround for https://bugs.chromium.org/p/chromium/issues/detail?id=1264266
export function patchChromiumScroll(element: HTMLElement) {
  element.style.display = 'none';
  forceReflow(element);
  element.style.display = '';
}
