import { useEffect } from '../lib/teact/teact';

import { createCallbackManager } from '../util/callbacks';

const blurCallbacks = createCallbackManager();
const focusCallbacks = createCallbackManager();

let isFocused = document.hasFocus();

window.addEventListener('blur', () => {
  if (!isFocused) {
    return;
  }

  isFocused = false;
  blurCallbacks.runCallbacks();
});

window.addEventListener('focus', () => {
  isFocused = true;
  focusCallbacks.runCallbacks();
});

export default function useBackgroundMode(
  onBlur?: AnyToVoidFunction,
  onFocus?: AnyToVoidFunction,
  isDisabled = false,
) {
  useEffect(() => {
    if (isDisabled) {
      return undefined;
    }

    if (!isFocused) {
      onBlur?.();
    }

    if (onBlur) {
      blurCallbacks.addCallback(onBlur);
    }

    if (onFocus) {
      focusCallbacks.addCallback(onFocus);
    }

    return () => {
      if (onFocus) {
        focusCallbacks.removeCallback(onFocus);
      }

      if (onBlur) {
        blurCallbacks.removeCallback(onBlur);
      }
    };
  }, [isDisabled, onBlur, onFocus]);
}

export function isBackgroundModeActive() {
  return !isFocused;
}
