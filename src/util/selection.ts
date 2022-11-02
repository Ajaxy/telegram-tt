const fragmentEl = document.createElement('div');

export function insertHtmlInSelection(html: string) {
  const selection = window.getSelection();

  if (selection?.getRangeAt && selection.rangeCount) {
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

export function getHtmlBeforeSelection(container?: HTMLElement, useCommonAncestor?: boolean) {
  if (!container) {
    return '';
  }

  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) {
    return container.innerHTML;
  }

  const range = sel.getRangeAt(0).cloneRange();
  if (!range.intersectsNode(container)) {
    return container.innerHTML;
  }

  if (!useCommonAncestor && !container.contains(range.commonAncestorContainer)) {
    return '';
  }

  range.collapse(true);
  range.setStart(container, 0);
  replaceChildren(fragmentEl, range.cloneContents());

  return fragmentEl.innerHTML;
}

function replaceChildren(el: HTMLElement, nodes?: DocumentFragment) {
  if (el.replaceChildren === undefined) {
    while (el.lastChild) {
      el.removeChild(el.lastChild);
    }
    if (nodes !== undefined) {
      el.append(nodes);
    }
  } else {
    el.replaceChildren(nodes || '');
  }
}
