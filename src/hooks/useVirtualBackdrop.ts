import type { RefObject } from 'react';
import { useEffect } from '../lib/teact/teact';

const BACKDROP_CLASSNAME = 'backdrop';

// This effect implements closing menus by clicking outside of them
// without adding extra elements to the DOM
export default function useVirtualBackdrop(
  isOpen: boolean,
  menuRef: RefObject<HTMLElement>,
  onClose?: () => void | undefined,
) {
  useEffect(() => {
    const handleEvent = (e: Event) => {
      const menu = menuRef.current;
      const target = e.target as HTMLElement | null;
      if (!menu || !target) {
        return;
      }

      if (
        !menu.contains(e.target as Node | null)
        || target.classList.contains(BACKDROP_CLASSNAME)
      ) {
        e.preventDefault();
        e.stopPropagation();
        if (onClose) {
          onClose();
        }
      }
    };

    if (isOpen && onClose) {
      document.addEventListener('mousedown', handleEvent);
    }

    return () => {
      document.removeEventListener('mousedown', handleEvent);
    };
  }, [isOpen, menuRef, onClose]);
}
