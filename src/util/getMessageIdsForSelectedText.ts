const ELEMENT_NODE = 1;

export default function getMessageIdsForSelectedText() {
  const selection = window.getSelection();
  let selectedFragments = selection && selection.rangeCount ? selection.getRangeAt(0).cloneContents() : undefined;
  if (!selectedFragments || selectedFragments.childElementCount === 0) {
    return;
  }

  const messageIds = Array.from(selectedFragments.children)
    .reduce((result, node) => {
      if (node.nodeType === ELEMENT_NODE && node.classList.contains('message-date-group')) {
        return Array.from(node.querySelectorAll('.Message'))
          .reduce((acc, messageEl) => acc.concat(Number((messageEl as HTMLElement).dataset.messageId)), result);
      } else if (node.nodeType === ELEMENT_NODE && node.classList.contains('Message')) {
        return result.concat(Number((node as HTMLElement).dataset.messageId));
      }

      return result;
    }, [] as number[]);


  // Cleanup a document fragment because it is playing media content in the background
  while (selectedFragments.firstChild) {
    selectedFragments.removeChild(selectedFragments.firstChild);
  }
  selectedFragments = undefined;

  return messageIds;
}
