import { useEffect, useRef } from '../lib/teact/teact';

import { IS_TOUCH_ENV } from '../util/windowEnvironment';
import useLastCallback from './useLastCallback';

const MENU_CLOSE_TIMEOUT = 250;
let closeTimeout: number | undefined;

export default function useMouseInside(
  isOpen: boolean, onClose: NoneToVoidFunction, menuCloseTimeout = MENU_CLOSE_TIMEOUT, isDisabled = false,
) {
  const isMouseInside = useRef(false);

  const markMouseInside = useLastCallback(() => {
    isMouseInside.current = true;
  });

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

  const handleMouseEnter = useLastCallback(() => {
    isMouseInside.current = true;
  });

  const handleMouseLeave = useLastCallback(() => {
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
  });

  return [handleMouseEnter, handleMouseLeave, markMouseInside];
}
