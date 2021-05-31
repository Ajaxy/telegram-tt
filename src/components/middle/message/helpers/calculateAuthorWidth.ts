let element: HTMLSpanElement | undefined;

export default function calculateAuthorWidth(text: string) {
  if (!element) {
    element = document.createElement('span');
    element.style.font = '400 12px Roboto, "Helvetica Neue", sans-serif';
    element.style.whiteSpace = 'nowrap';
    element.style.position = 'absolute';
    element.style.left = '-999px';
    element.style.opacity = '.01';
    document.body.appendChild(element);
  }

  element.innerHTML = text;

  return element.offsetWidth;
}
