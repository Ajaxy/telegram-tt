export default function isFullyVisible(container: HTMLElement, element: HTMLElement, isHorizontal = false) {
  const viewportY1 = container[isHorizontal ? 'scrollLeft' : 'scrollTop'];
  const viewportY2 = viewportY1 + container[isHorizontal ? 'offsetWidth' : 'offsetHeight'];
  const y1 = element[isHorizontal ? 'offsetLeft' : 'offsetTop'];
  const y2 = y1 + element[isHorizontal ? 'offsetWidth' : 'offsetHeight'];
  return y1 > viewportY1 && y2 < viewportY2;
}
