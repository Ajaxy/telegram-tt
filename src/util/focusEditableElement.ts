export default function focusEditableElement(element: HTMLElement, force?: boolean) {
  if (!force && element === document.activeElement) {
    return;
  }
  const selection = window.getSelection()!;
  const range = document.createRange();

  if (!element.lastChild || !element.lastChild.nodeValue) {
    element.focus();
    return;
  }

  range.setStart(element.lastChild, element.lastChild.nodeValue.length);
  selection.removeAllRanges();
  selection.addRange(range);
}
