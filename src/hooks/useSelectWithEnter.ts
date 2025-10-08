import { useEffect, useRef } from '../lib/teact/teact';

import useLastCallback from './useLastCallback.ts';

const useSendWithEnter = (
  onSelect: NoneToVoidFunction,
) => {
  const buttonRef = useRef<HTMLDivElement>();

  const handleKeyDown = useLastCallback((e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    const isFocused = buttonRef.current === document.activeElement;

    if (isFocused) {
      onSelect();
    }
  });

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, false);

    return () => window.removeEventListener('keydown', handleKeyDown, false);
  }, []);

  return buttonRef;
};

export default useSendWithEnter;
