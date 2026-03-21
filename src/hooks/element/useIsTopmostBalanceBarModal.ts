import { useEffect, useState } from '../../lib/teact/teact';

import { createCallbackManager } from '../../util/callbacks';

const BALANCE_BAR_MODAL_SELECTOR = '.Modal.with-balance-bar';

const balanceBarCallbacks = createCallbackManager();

export default function useIsTopmostBalanceBarModal(
  ref: { current?: HTMLElement },
  isActive?: boolean,
) {
  const [isTopmost, setIsTopmost] = useState(true);

  useEffect(() => {
    if (!isActive) return undefined;

    const updateIsTopmost = () => {
      setIsTopmost(checkIsTopmostBalanceBarModal(ref.current));
    };

    updateIsTopmost();

    const unsubscribe = balanceBarCallbacks.addCallback(updateIsTopmost);
    balanceBarCallbacks.runCallbacks();

    return () => {
      unsubscribe();
      balanceBarCallbacks.runCallbacks();
    };
  }, [isActive, ref]);

  return isTopmost;
}

function checkIsTopmostBalanceBarModal(element?: HTMLElement) {
  if (!element) return true;

  const parentModal = element.closest(BALANCE_BAR_MODAL_SELECTOR);
  if (!parentModal) return true;

  const allBalanceBarModals = document.querySelectorAll(BALANCE_BAR_MODAL_SELECTOR);
  if (allBalanceBarModals.length <= 1) {
    return true;
  }

  let topmostModal: Element | undefined;
  let highestZIndex = -Infinity;

  allBalanceBarModals.forEach((modal) => {
    const zIndex = parseInt(getComputedStyle(modal).zIndex, 10) || 0;
    if (zIndex >= highestZIndex) {
      highestZIndex = zIndex;
      topmostModal = modal;
    }
  });

  return parentModal === topmostModal;
}
