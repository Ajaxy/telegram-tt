// https://stackoverflow.com/a/36953852
export function setCaretPosition(element: Node, position: number) {
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      if ((node as Text).length >= position) {
        const range = document.createRange();
        const selection = window.getSelection()!;
        range.setStart(node, position);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);

        return -1;
      } else {
        position -= 'length' in node ? node.length as number : 0;
      }
    } else {
      position = setCaretPosition(node, position);
      if (position === -1) {
        return -1;
      }
    }
  }

  return position;
}

export function removeAllSelections() {
  const selection = window.getSelection();
  selection?.removeAllRanges();
}
