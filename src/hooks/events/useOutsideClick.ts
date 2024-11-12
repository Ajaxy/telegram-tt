import { useEffect } from '../../lib/teact/teact';

import useLastCallback from '../useLastCallback';

export function useClickOutside(
  refs: React.RefObject<HTMLElement>[], callback: (event: MouseEvent) => void,
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
