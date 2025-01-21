export default function getOffsetToContainer(element: HTMLElement, container: HTMLElement) {
  let offsetTop = 0;
  let offsetLeft = 0;

  let current: HTMLElement | null = element;

  while (current && current !== container && !current.contains(container)) {
    offsetTop += current.offsetTop;
    offsetLeft += current.offsetLeft;

    current = current.offsetParent as HTMLElement;
  }

  return { top: offsetTop, left: offsetLeft };
}
