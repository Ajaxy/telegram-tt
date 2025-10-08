import type { ElementRef } from '../lib/teact/teact';
import { useEffect } from '../lib/teact/teact';

import { requestMeasure } from '../lib/fasterdom/fasterdom';
import { IS_TOUCH_ENV } from '../util/browser/windowEnvironment';
import focusNoScroll from '../util/focusNoScroll';

const MODAL_HIDE_DELAY_MS = 300;

export default function useInputFocusOnOpen(
  inputRef: ElementRef<HTMLInputElement | HTMLTextAreaElement>,
  isOpen?: boolean,
  onClose?: NoneToVoidFunction,
) {
  useEffect(() => {
    if (isOpen) {
      if (!IS_TOUCH_ENV && inputRef.current?.isConnected) {
        requestMeasure(() => {
          focusNoScroll(inputRef.current);
        });
      }
    } else {
      if (inputRef.current?.isConnected) {
        inputRef.current.blur();
      }

      if (onClose) {
        setTimeout(onClose, MODAL_HIDE_DELAY_MS);
      }
    }
  }, [inputRef, isOpen, onClose]);
}
