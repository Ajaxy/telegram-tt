import isFullyVisible from './visibility/isFullyVisible';
import animateScroll from './animateScroll';
import findInViewport from './findInViewport';

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
    animateScroll({
      container,
      element: allElements[index],
      position,
      margin: SCROLL_MARGIN,
    });
  }
}
