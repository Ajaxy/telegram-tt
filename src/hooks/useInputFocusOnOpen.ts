import type { RefObject } from 'react';
import { useEffect } from '../lib/teact/teact';
import { IS_SINGLE_COLUMN_LAYOUT } from '../util/environment';

// Focus slows down animation, also it breaks transition layout in Chrome
const FOCUS_DELAY_MS = 500;
const MODAL_HIDE_DELAY_MS = 300;

export default function useInputFocusOnOpen(
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement>,
  isOpen?: boolean,
  onClose?: NoneToVoidFunction,
) {
  useEffect(() => {
    if (isOpen) {
      if (!IS_SINGLE_COLUMN_LAYOUT) {
        setTimeout(() => {
          requestAnimationFrame(() => {
            if (inputRef.current?.isConnected) {
              inputRef.current.focus();
            }
          });
        }, FOCUS_DELAY_MS);
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
