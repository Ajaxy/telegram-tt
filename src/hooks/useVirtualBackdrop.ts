import type { RefObject } from 'react';
import { useEffect } from '../lib/teact/teact';

import { hasActiveViewTransition } from './animations/useViewTransition';

const BACKDROP_CLASSNAME = 'backdrop';

// This effect implements closing menus by clicking outside of them
// without adding extra elements to the DOM
export default function useVirtualBackdrop(
  isOpen: boolean,
  containerRef: RefObject<HTMLElement>,
  onClose?: () => void | undefined,
  ignoreRightClick?: boolean,
  excludedClosestSelector?: string,
) {
  useEffect(() => {
    if (!isOpen || !onClose) {
      return undefined;
    }

    const handleEvent = (e: MouseEvent) => {
      const container = containerRef.current;
      const target = e.target as HTMLElement | null;
      if (!container || !target || (ignoreRightClick && e.button === 2) || hasActiveViewTransition()) {
        return;
      }

      if ((
        !container.contains(e.target as Node | null)
        || target.classList.contains(BACKDROP_CLASSNAME)
      ) && !(excludedClosestSelector && (
        target.matches(excludedClosestSelector) || target.closest(excludedClosestSelector)
      ))) {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleEvent);

    return () => {
      document.removeEventListener('mousedown', handleEvent);
    };
  }, [excludedClosestSelector, ignoreRightClick, isOpen, containerRef, onClose]);
}
