export default function insertHtmlInSelection(html: string) {
  const selection = window.getSelection();

  if (selection && selection.getRangeAt && selection.rangeCount) {
    const range = selection.getRangeAt(0);
    range.deleteContents();

    const fragment = range.createContextualFragment(html);
    const lastInsertedNode = fragment.lastChild;
    range.insertNode(fragment);
    if (lastInsertedNode) {
      range.setStartAfter(lastInsertedNode);
      range.setEndAfter(lastInsertedNode);
    } else {
      range.collapse(false);
    }
    selection.removeAllRanges();
    selection.addRange(range);
  }
}
