import { EDITABLE_INPUT_ID, EDITABLE_INPUT_MODAL_ID } from '../../../../config';

const MAX_NESTING_PARENTS = 5;

export function isSelectionInsideInput(selectionRange: Range, inputId: string) {
  const { commonAncestorContainer } = selectionRange;
  let parentNode: HTMLElement | null = commonAncestorContainer as HTMLElement;
  let iterations = 1;
  while (parentNode && parentNode.id !== inputId && iterations < MAX_NESTING_PARENTS) {
    parentNode = parentNode.parentElement;
    iterations++;
  }

  return Boolean(parentNode && parentNode.id === inputId);
}

export function isComposerHasSelection() {
  const activeElement = document.activeElement;
  const isComposerFocused = activeElement?.id === EDITABLE_INPUT_ID
    || activeElement?.id === EDITABLE_INPUT_MODAL_ID;

  if (!isComposerFocused) return false;

  const selection = window.getSelection();
  return Boolean(selection && !selection.isCollapsed);
}
