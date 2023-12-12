export function isSelectionRangeInsideMessage(range: Range) {
  const ancestor = range.commonAncestorContainer;
  const el = ancestor.nodeType === Node.TEXT_NODE
    ? ancestor.parentNode! as Element
    : ancestor as Element;

  return Boolean(el.closest('.message-content-wrapper .text-content'))
    && !(Boolean(el.closest('.EmbeddedMessage')) || Boolean(el.closest('.WebPage')));
}
