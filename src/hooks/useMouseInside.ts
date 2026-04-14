import { useEffect, useRef } from '../lib/teact/teact';

import { IS_TOUCH_ENV } from '../util/browser/windowEnvironment';
import useLastCallback from './useLastCallback';

const MENU_CLOSE_TIMEOUT = 250;
let closeTimeout: number | undefined;

export default function useMouseInside(
  isOpen: boolean, onClose: NoneToVoidFunction, menuCloseTimeout = MENU_CLOSE_TIMEOUT, isDisabled = false,
) {
  const isMouseInsideRef = useRef(false);

  const markMouseInside = useLastCallback(() => {
    isMouseInsideRef.current = true;
  });

  useEffect(() => {
    if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = undefined;
    }

    if (isOpen && !IS_TOUCH_ENV && !isDisabled) {
      closeTimeout = window.setTimeout(() => {
        if (!isMouseInsideRef.current) {
          onClose();
        }
      }, menuCloseTimeout * 2);
    }
  }, [isDisabled, isOpen, menuCloseTimeout, onClose]);

  const handleMouseEnter = useLastCallback(() => {
    isMouseInsideRef.current = true;
  });

  const handleMouseLeave = useLastCallback(() => {
    isMouseInsideRef.current = false;

    if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = undefined;
    }

    closeTimeout = window.setTimeout(() => {
      if (!isMouseInsideRef.current) {
        onClose();
      }
    }, menuCloseTimeout);
  });

  return [handleMouseEnter, handleMouseLeave, markMouseInside];
}
