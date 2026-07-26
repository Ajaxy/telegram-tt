import { EDITABLE_INPUT_ID, EDITABLE_INPUT_MODAL_ID } from '../../../../config';

export function isSelectionInsideInput(selectionRange: Range, inputId: string) {
  return Boolean(document.getElementById(inputId)?.contains(selectionRange.commonAncestorContainer));
}

export function isComposerHasSelection() {
  const activeElement = document.activeElement;
  const isComposerFocused = activeElement?.id === EDITABLE_INPUT_ID
    || activeElement?.id === EDITABLE_INPUT_MODAL_ID;

  if (!isComposerFocused) return false;

  const selection = window.getSelection();
  return Boolean(selection && !selection.isCollapsed);
}
