import findInViewport from './findInViewport';
import isFullyVisible from './isFullyVisible';
import fastSmoothScroll from './fastSmoothScroll';

const VIEWPORT_MARGIN = 8;
const SCROLL_MARGIN = 10;

export default function setTooltipItemVisible(selector: string, index: number, containerRef: Record<string, any>) {
  const container = containerRef.current!;
  if (!container || index < 0) {
    return;
  }
  const { visibleIndexes, allElements } = findInViewport(
    container,
    selector,
    VIEWPORT_MARGIN,
    true,
    true,
  );

  if (!allElements.length || !allElements[index]) {
    return;
  }
  const first = visibleIndexes[0];
  if (!visibleIndexes.includes(index)
    || (index === first && !isFullyVisible(container, allElements[first]))) {
    const position = index > visibleIndexes[visibleIndexes.length - 1] ? 'start' : 'end';
    fastSmoothScroll(container, allElements[index], position, SCROLL_MARGIN);
  }
}
