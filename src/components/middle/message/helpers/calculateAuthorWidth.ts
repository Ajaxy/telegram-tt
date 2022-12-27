let element: HTMLSpanElement | undefined;
let fontFamily: string | undefined;
export default function calculateAuthorWidth(text: string) {
  if (!fontFamily) {
    fontFamily = getComputedStyle(document.documentElement).getPropertyValue('--font-family');
  }

  if (!element) {
    element = document.createElement('span');
    // eslint-disable-next-line max-len
    element.style.font = `400 12px ${fontFamily}`;
    element.style.whiteSpace = 'nowrap';
    element.style.position = 'absolute';
    element.style.left = '-999px';
    element.style.opacity = '.01';
    document.body.appendChild(element);
  }

  element.textContent = text;

  return element.offsetWidth;
}
