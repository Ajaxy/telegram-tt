import { IS_IOS } from './environment';

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
