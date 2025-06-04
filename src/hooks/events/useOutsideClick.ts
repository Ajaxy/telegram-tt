import type { ElementRef } from '../../lib/teact/teact';
import { useEffect } from '../../lib/teact/teact';

import useLastCallback from '../useLastCallback';

// Fragile
export function useClickOutside(
  refs: ElementRef<HTMLElement>[], callback: (event: MouseEvent) => void,
) {
  const handleClickOutside = useLastCallback((event: MouseEvent) => {
    const clickedOutside = refs.every((ref) => {
      return ref.current && !ref.current.contains(event.target as Node);
    });

    if (clickedOutside) callback(event);
  });

  useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [handleClickOutside]);
}
