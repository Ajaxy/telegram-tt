import type React from '../../../lib/teact/teact';

import { EDITABLE_INPUT_ID } from '../../../config';
import { IS_IOS } from '../../../util/windowEnvironment';

export function preventMessageInputBlur(e: React.MouseEvent<HTMLElement>, withBubbling = false) {
  if (
    IS_IOS
    || !document.activeElement
    || document.activeElement.id !== EDITABLE_INPUT_ID
    || (!withBubbling && e.target !== e.currentTarget)
  ) {
    return;
  }

  e.preventDefault();
}

export function preventMessageInputBlurWithBubbling(e: React.MouseEvent<HTMLElement>) {
  preventMessageInputBlur(e, true);
}
