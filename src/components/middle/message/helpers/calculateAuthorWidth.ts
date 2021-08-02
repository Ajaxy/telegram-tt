import { IS_IOS } from '../../../../util/environment';

let element: HTMLSpanElement | undefined;

export default function calculateAuthorWidth(text: string) {
  if (!element) {
    element = document.createElement('span');
    // eslint-disable-next-line max-len
    element.style.font = IS_IOS
      // eslint-disable-next-line max-len
      ? '400 12px system-ui, -apple-system, BlinkMacSystemFont, "Roboto", "Apple Color Emoji", "Helvetica Neue", sans-serif'
      : '400 12px "Roboto", -apple-system, "Apple Color Emoji", BlinkMacSystemFont, "Helvetica Neue", sans-serif';
    element.style.whiteSpace = 'nowrap';
    element.style.position = 'absolute';
    element.style.left = '-999px';
    element.style.opacity = '.01';
    document.body.appendChild(element);
  }

  element.innerHTML = text;

  return element.offsetWidth;
}
