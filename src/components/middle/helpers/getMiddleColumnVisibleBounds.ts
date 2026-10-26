const LAYOUT_TRANSITION_PROPERTIES = new Set([
  'transform', 'width', 'height', 'top', 'right', 'bottom', 'left', 'margin-top', 'margin-bottom',
]);
const LAYOUT_TRANSITION_TARGETS = '#MiddleColumn, .MiddleHeader, .MiddleHeaderPanesIsland, '
  + '.middle-column-footer, .MessageList, .messages-layout, .messages-layout > .Transition > .Transition_slide';

export default function getMiddleColumnVisibleBounds(column: HTMLElement) {
  const bounds = column.getBoundingClientRect();
  const left = Math.max(bounds.left, 0);
  let right = Math.min(bounds.right, window.innerWidth);
  let top = Math.max(bounds.top, 0);
  let bottom = Math.min(bounds.bottom, window.visualViewport?.height ?? window.innerHeight);

  const main = column.closest('#Main')!;
  const rightColumn = main.querySelector<HTMLElement>('#RightColumn')!;
  if (main.classList.contains('right-column-shown') && rightColumn.offsetWidth) {
    // Reserve the panel's resting bounds while it slides over the middle column
    const rightColumnLeft = rightColumn.parentElement!.getBoundingClientRect().left + rightColumn.offsetLeft;
    right = Math.max(left, Math.min(right, rightColumnLeft));
  }

  column.querySelectorAll('.MiddleHeader, .MiddleHeaderPanesIsland').forEach((header) => {
    const headerBounds = header.getBoundingClientRect();
    if (headerBounds.height) top = Math.max(top, headerBounds.bottom);
  });
  column.querySelectorAll<HTMLElement>('.middle-column-footer').forEach((footer) => {
    const slide = footer.closest('.Transition_slide');
    if (!footer.offsetParent || (slide && !slide.classList.contains('Transition_slide-active'))) return;

    const footerBounds = footer.getBoundingClientRect();
    if (footerBounds.height) bottom = Math.min(bottom, footerBounds.top);
  });

  return {
    top,
    bottom,
    left,
    right,
  };
}

export function isMiddleColumnLayoutTransition(e: TransitionEvent) {
  return e.target instanceof Element && e.target.matches(LAYOUT_TRANSITION_TARGETS)
    && LAYOUT_TRANSITION_PROPERTIES.has(e.propertyName);
}
