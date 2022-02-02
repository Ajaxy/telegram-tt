import { RefObject } from 'react';
import { useState, useEffect, useCallback } from '../lib/teact/teact';

import { IAnchorPosition } from '../types';
import {
  IS_TOUCH_ENV, IS_SINGLE_COLUMN_LAYOUT, IS_PWA, IS_IOS,
} from '../util/environment';

const LONG_TAP_DURATION_MS = 200;

function checkIsDisabledForMobile() {
  return IS_SINGLE_COLUMN_LAYOUT
  && window.document.body.classList.contains('enable-symbol-menu-transforms');
}

function stopEvent(e: Event) {
  e.stopImmediatePropagation();
  e.preventDefault();
  e.stopPropagation();
}

const useContextMenuHandlers = (
  elementRef: RefObject<HTMLElement>,
  isMenuDisabled?: boolean,
  shouldDisableOnLink?: boolean,
  shouldDisableOnLongTap?: boolean,
) => {
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<IAnchorPosition | undefined>(undefined);

  const handleBeforeContextMenu = useCallback((e: React.MouseEvent) => {
    if (!isMenuDisabled && e.button === 2) {
      (e.target as HTMLElement).classList.add('no-selection');
    }
  }, [isMenuDisabled]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    (e.target as HTMLElement).classList.remove('no-selection');

    if (isMenuDisabled || (shouldDisableOnLink && (e.target as HTMLElement).matches('a[href]'))) {
      return;
    }
    e.preventDefault();

    if (contextMenuPosition) {
      return;
    }

    setIsContextMenuOpen(true);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  }, [isMenuDisabled, shouldDisableOnLink, contextMenuPosition]);

  const handleContextMenuClose = useCallback(() => {
    setIsContextMenuOpen(false);
  }, []);

  const handleContextMenuHide = useCallback(() => {
    setContextMenuPosition(undefined);
    document.body.classList.remove('no-selection');
  }, []);

  // Support context menu on touch-devices
  useEffect(() => {
    if (isMenuDisabled || !IS_TOUCH_ENV || shouldDisableOnLongTap) {
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

      const { clientX, clientY, target } = originalEvent.touches[0];

      if (contextMenuPosition || (shouldDisableOnLink && (target as HTMLElement).matches('a[href]'))) {
        return;
      }

      // Temporarily intercept and clear the next click
      element.addEventListener('touchend', function cancelClickOnce(e) {
        element.removeEventListener('touchend', cancelClickOnce, true);
        stopEvent(e);
      }, true);

      // On iOS15, in PWA mode, the context menu immediately closes after opening
      if (IS_PWA && IS_IOS) {
        element.addEventListener('mousedown', function cancelClickOnce(e) {
          element.removeEventListener('mousedown', cancelClickOnce, true);
          stopEvent(e);
        }, true);
      }

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
  }, [contextMenuPosition, isMenuDisabled, shouldDisableOnLongTap, elementRef, shouldDisableOnLink]);

  return {
    isContextMenuOpen,
    contextMenuPosition,
    handleBeforeContextMenu,
    handleContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  };
};

export default useContextMenuHandlers;
