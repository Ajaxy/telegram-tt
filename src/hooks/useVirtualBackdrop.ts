import type { ElementRef } from '../lib/teact/teact';
import { useEffect } from '../lib/teact/teact';

import { hasActiveViewTransition } from './animations/useViewTransition';
import useWindow from './useWindow';

const BACKDROP_CLASSNAME = 'backdrop';

// This effect implements closing menus by clicking outside of them
// without adding extra elements to the DOM
export default function useVirtualBackdrop(
  isOpen: boolean,
  containerRef: ElementRef<HTMLElement>,
  onClose?: () => void | undefined,
  ignoreRightClick?: boolean,
  excludedClosestSelector?: string,
) {
  const renderingWindow = useWindow();

  useEffect(() => {
    if (!isOpen || !onClose) {
      return undefined;
    }

    const ownerDocument = containerRef.current?.ownerDocument || renderingWindow.document;
    const handleEvent = (e: MouseEvent) => {
      const container = containerRef.current;
      const target = e.target as HTMLElement | null;
      if (
        !container || !target || (ignoreRightClick && e.button === 2)
        || (ownerDocument === document && hasActiveViewTransition())
      ) {
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

    ownerDocument.addEventListener('mousedown', handleEvent);

    return () => {
      ownerDocument.removeEventListener('mousedown', handleEvent);
    };
  }, [excludedClosestSelector, ignoreRightClick, isOpen, containerRef, onClose, renderingWindow]);
}
