import React from '../../../lib/teact/teact';

import { EDITABLE_INPUT_ID } from '../../../config';
import { IS_IOS } from '../../../util/environment';

export function preventMessageInputBlur(e: React.MouseEvent<HTMLElement>) {
  if (
    IS_IOS
    || !document.activeElement
    || document.activeElement.id !== EDITABLE_INPUT_ID
    || e.target !== e.currentTarget
  ) {
    return;
  }

  e.preventDefault();
}
