// Used before applying CSS transition
export default function forceReflow(element: HTMLElement) {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  element.offsetWidth;
}
