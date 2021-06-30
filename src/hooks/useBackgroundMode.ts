import { useEffect } from '../lib/teact/teact';

export default function useBackgroundMode(
  onBlur?: AnyToVoidFunction,
  onFocus?: AnyToVoidFunction,
) {
  useEffect(() => {
    if (onBlur && !document.hasFocus()) {
      onBlur();
    }

    if (onBlur) {
      window.addEventListener('blur', onBlur);
    }

    if (onFocus) {
      window.addEventListener('focus', onFocus);
    }

    return () => {
      if (onFocus) {
        window.removeEventListener('focus', onFocus);
      }

      if (onBlur) {
        window.removeEventListener('blur', onBlur);
      }
    };
  }, [onBlur, onFocus]);
}
