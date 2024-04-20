import type { RefObject } from 'react';
import { useEffect, useState } from '../lib/teact/teact';
import { addExtraClass, removeExtraClass } from '../lib/teact/teact-dom';

import type { IAnchorPosition } from '../types';
import type { Signal } from '../util/signals';

import { requestMutation } from '../lib/fasterdom/fasterdom';
import {
  IS_IOS,
  IS_PWA, IS_TOUCH_ENV,
} from '../util/windowEnvironment';
import useLastCallback from './useLastCallback';

const LONG_TAP_DURATION_MS = 200;
const IOS_PWA_CONTEXT_MENU_DELAY_MS = 100;

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
  getIsReady?: Signal<boolean>,
) => {
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<IAnchorPosition | undefined>(undefined);
  const [contextMenuTarget, setContextMenuTarget] = useState<HTMLElement | undefined>(undefined);

  const handleBeforeContextMenu = useLastCallback((e: React.MouseEvent) => {
    if (!isMenuDisabled && e.button === 2) {
      requestMutation(() => {
        addExtraClass(e.target as HTMLElement, 'no-selection');
      });
    }
  });

  const handleContextMenu = useLastCallback((e: React.MouseEvent) => {
    requestMutation(() => {
      removeExtraClass(e.target as HTMLElement, 'no-selection');
    });

    if (isMenuDisabled || (shouldDisableOnLink && (e.target as HTMLElement).matches('a[href]'))) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    if (contextMenuPosition) {
      return;
    }

    setIsContextMenuOpen(true);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuTarget(e.target as HTMLElement);
  });

  const handleContextMenuClose = useLastCallback(() => {
    setIsContextMenuOpen(false);
  });

  const handleContextMenuHide = useLastCallback(() => {
    setContextMenuPosition(undefined);
  });

  // Support context menu on touch devices
  useEffect(() => {
    if (isMenuDisabled || !IS_TOUCH_ENV || shouldDisableOnLongTap || (getIsReady && !getIsReady())) {
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
      document.addEventListener('touchend', (e) => {
        // On iOS in PWA mode, the context menu may cause click-through to the element in the menu upon opening
        if (IS_IOS && IS_PWA) {
          setTimeout(() => {
            document.removeEventListener('mousedown', stopEvent, {
              capture: true,
            });
            document.removeEventListener('click', stopEvent, {
              capture: true,
            });
          }, IOS_PWA_CONTEXT_MENU_DELAY_MS);
        }
        stopEvent(e);
      }, {
        once: true,
        capture: true,
      });

      // On iOS15, in PWA mode, the context menu immediately closes after opening
      if (IS_PWA && IS_IOS) {
        document.addEventListener('mousedown', stopEvent, {
          once: true,
          capture: true,
        });
        document.addEventListener('click', stopEvent, {
          once: true,
          capture: true,
        });
      }

      setIsContextMenuOpen(true);
      setContextMenuPosition({ x: clientX, y: clientY });
    };

    const startLongPressTimer = (e: TouchEvent) => {
      if (isMenuDisabled) {
        return;
      }
      e.stopPropagation();
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
  }, [
    contextMenuPosition, isMenuDisabled, shouldDisableOnLongTap, elementRef, shouldDisableOnLink, getIsReady,
  ]);

  return {
    isContextMenuOpen,
    contextMenuPosition,
    contextMenuTarget,
    handleBeforeContextMenu,
    handleContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  };
};

export default useContextMenuHandlers;
