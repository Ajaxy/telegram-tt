import { useEffect } from '../lib/teact/teact';

export default (
  onBlur: AnyToVoidFunction,
  onFocus: AnyToVoidFunction,
) => {
  useEffect(() => {
    if (!document.hasFocus()) {
      onBlur();
    }

    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, [onBlur, onFocus]);
};
