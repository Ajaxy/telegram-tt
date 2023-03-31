import { useCallback, useEffect, useRef } from '../lib/teact/teact';

export default function useBackgroundMode(
  onBlur?: AnyToVoidFunction,
  onFocus?: AnyToVoidFunction,
  isDisabled = false,
) {
  const wasBlurred = useRef<boolean>(false);
  const handleBlur = useCallback(() => {
    if (wasBlurred.current) {
      return;
    }

    onBlur?.();
    wasBlurred.current = true;
  }, [onBlur]);
  const handleFocus = useCallback(() => {
    onFocus?.();
    wasBlurred.current = false;
  }, [onFocus]);

  useEffect(() => {
    if (isDisabled) {
      return undefined;
    }

    if (onBlur && !document.hasFocus()) {
      handleBlur();
    }

    if (onBlur) {
      window.addEventListener('blur', handleBlur);
    }

    if (onFocus) {
      window.addEventListener('focus', handleFocus);
    }

    return () => {
      if (onFocus) {
        window.removeEventListener('focus', handleFocus);
      }

      if (onBlur) {
        window.removeEventListener('blur', handleBlur);
      }
    };
  }, [handleBlur, handleFocus, isDisabled, onBlur, onFocus]);
}
