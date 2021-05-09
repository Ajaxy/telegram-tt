function isFullyVisible(container: HTMLElement, element: HTMLElement) {
  const viewportY1 = container.scrollTop;
  const viewportY2 = viewportY1 + container.offsetHeight;
  const y1 = element.offsetTop;
  const y2 = y1 + element.offsetHeight;
  return y1 > viewportY1 && y2 < viewportY2;
}

export default isFullyVisible;
