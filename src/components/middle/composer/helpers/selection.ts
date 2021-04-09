import { EDITABLE_INPUT_ID } from '../../../../config';

const MAX_NESTING_PARENTS = 5;

export function isSelectionInsideInput(selectionRange: Range) {
  const { commonAncestorContainer } = selectionRange;
  let parentNode: HTMLElement | null = commonAncestorContainer as HTMLElement;
  let iterations = 1;
  while (parentNode && parentNode.id !== EDITABLE_INPUT_ID && iterations < MAX_NESTING_PARENTS) {
    parentNode = parentNode.parentElement;
    iterations++;
  }

  return Boolean(parentNode && parentNode.id === EDITABLE_INPUT_ID);
}
