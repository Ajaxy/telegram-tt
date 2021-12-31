import { useCallback, useEffect, useRef } from '../lib/teact/teact';

import { IS_TOUCH_ENV } from '../util/environment';

const MENU_CLOSE_TIMEOUT = 250;
let closeTimeout: number | undefined;

export default function useMouseInside(
  isOpen: boolean, onClose: NoneToVoidFunction, menuCloseTimeout = MENU_CLOSE_TIMEOUT, isDisabled = false,
) {
  const isMouseInside = useRef(false);

  const markMouseInside = useCallback(() => {
    isMouseInside.current = true;
  }, []);

  useEffect(() => {
    if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = undefined;
    }

    if (isOpen && !IS_TOUCH_ENV && !isDisabled) {
      closeTimeout = window.setTimeout(() => {
        if (!isMouseInside.current) {
          onClose();
        }
      }, menuCloseTimeout * 2);
    }
  }, [isDisabled, isOpen, menuCloseTimeout, onClose]);

  const handleMouseEnter = useCallback(() => {
    isMouseInside.current = true;
  }, []);

  const handleMouseLeave = useCallback(() => {
    isMouseInside.current = false;

    if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = undefined;
    }

    closeTimeout = window.setTimeout(() => {
      if (!isMouseInside.current) {
        onClose();
      }
    }, menuCloseTimeout);
  }, [menuCloseTimeout, onClose]);

  return [handleMouseEnter, handleMouseLeave, markMouseInside];
}
