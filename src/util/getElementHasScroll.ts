export default function getElementHasScroll(el: HTMLElement): boolean {
  return el.scrollHeight > el.clientHeight;
}
