import { IS_IOS } from './windowEnvironment';
import forceReflow from './forceReflow';

const resetScroll = (container: HTMLDivElement, scrollTop?: number) => {
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

export function stopScrollInertia(element: HTMLElement) {
  element.style.display = 'none';
  forceReflow(element);
  element.style.display = '';
}

export default resetScroll;
