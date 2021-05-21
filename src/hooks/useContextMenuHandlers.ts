import { RefObject } from 'react';
import { useState, useEffect, useCallback } from '../lib/teact/teact';

import { IAnchorPosition } from '../types';
import { IS_TOUCH_ENV, IS_MOBILE_SCREEN } from '../util/environment';

const LONG_TAP_DURATION_MS = 250;
const SELECTION_ANIMATION_DURATION_MS = 200;

let contextMenuCounter = 0;

function checkIsDisabledForMobile() {
  return IS_MOBILE_SCREEN
  && window.document.body.classList.contains('enable-symbol-menu-transforms');
}

export default (
  elementRef: RefObject<HTMLElement>,
  isMenuDisabled?: boolean,
  shouldDisableOnLink?: boolean,
) => {
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<IAnchorPosition | undefined>(undefined);

  const handleBeforeContextMenu = useCallback((e: React.MouseEvent) => {
    if (!isMenuDisabled && e.button === 2) {
      document.body.classList.add('no-selection');
    }
  }, [isMenuDisabled]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    document.body.classList.remove('no-selection');

    if (isMenuDisabled || (shouldDisableOnLink && (e.target as HTMLElement).matches('a.text-entity-link[href]'))) {
      return;
    }
    e.preventDefault();

    if (contextMenuPosition) {
      return;
    }
    document.body.classList.remove('no-selection');
    if (contextMenuCounter === 0) {
      document.body.classList.add('has-context-menu');
    }
    contextMenuCounter++;

    setIsContextMenuOpen(true);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  }, [isMenuDisabled, shouldDisableOnLink, contextMenuPosition]);

  const handleContextMenuClose = useCallback(() => {
    setIsContextMenuOpen(false);
  }, []);

  const handleContextMenuHide = useCallback(() => {
    setContextMenuPosition(undefined);
    document.body.classList.remove('no-selection');

    setTimeout(() => {
      contextMenuCounter--;
      if (contextMenuCounter === 0) {
        document.body.classList.remove('has-context-menu');
      }
    }, SELECTION_ANIMATION_DURATION_MS);
  }, []);

  // Support context menu on touch-devices
  useEffect(() => {
    if (isMenuDisabled || !IS_TOUCH_ENV) {
      return undefined;
    }

    const element = elementRef.current;
    if (!element) {
      return undefined;
    }

    let timer: number | undefined;

    const clearLongPressTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    };

    const emulateContextMenuEvent = (originalEvent: TouchEvent) => {
      clearLongPressTimer();

      const { clientX, clientY } = originalEvent.touches[0];

      if (contextMenuPosition) {
        return;
      }

      // temporarily intercept and clear the next click
      element.addEventListener('touchend', function cancelClickOnce(e) {
        element.removeEventListener('touchend', cancelClickOnce, true);
        e.stopImmediatePropagation();
        e.preventDefault();
        e.stopPropagation();
      }, true);

      document.body.classList.add('no-selection');
      setIsContextMenuOpen(true);
      setContextMenuPosition({ x: clientX, y: clientY });
    };

    const startLongPressTimer = (e: TouchEvent) => {
      if (isMenuDisabled || checkIsDisabledForMobile()) {
        return;
      }
      clearLongPressTimer();

      timer = window.setTimeout(() => emulateContextMenuEvent(e), LONG_TAP_DURATION_MS);
    };

    // @perf Consider event delegation
    element.addEventListener('touchstart', startLongPressTimer, { passive: true });
    element.addEventListener('touchcancel', clearLongPressTimer, true);
    element.addEventListener('touchend', clearLongPressTimer, true);
    element.addEventListener('touchmove', clearLongPressTimer, { passive: true });

    return () => {
      clearLongPressTimer();
      element.removeEventListener('touchstart', startLongPressTimer);
      element.removeEventListener('touchcancel', clearLongPressTimer, true);
      element.removeEventListener('touchend', clearLongPressTimer, true);
      element.removeEventListener('touchmove', clearLongPressTimer);
    };
  }, [contextMenuPosition, isMenuDisabled, elementRef]);

  return {
    isContextMenuOpen,
    contextMenuPosition,
    handleBeforeContextMenu,
    handleContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  };
};
