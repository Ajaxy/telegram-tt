import { useRef, useState } from '../../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../../global';

import { PAID_MESSAGES_PURPOSE } from '../../../../config';

import useLastCallback from '../../../../hooks/useLastCallback';

export default function usePaidMessageConfirmation(
  starsForAllMessages: number,
) {
  const {
    shouldPaidMessageAutoApprove,
  } = getGlobal().settings.byKey;

  const [shouldAutoApprove,
    setAutoApprove] = useState(Boolean(shouldPaidMessageAutoApprove));
  const confirmPaymentHandlerRef = useRef<NoneToVoidFunction | undefined>(undefined);

  const closeConfirmDialog = useLastCallback(() => {
    getActions().closePaymentMessageConfirmDialogOpen();
  });

  const handleWithConfirmation = <T extends (...args: any[]) => void>(
    handler: T,
    ...args: Parameters<T>
  ) => {
    if (starsForAllMessages) {
      const balance = getGlobal().stars?.balance.amount;
      if (balance && starsForAllMessages > balance) {
        getActions().openStarsBalanceModal({
          topup:
          { balanceNeeded: starsForAllMessages, purpose: PAID_MESSAGES_PURPOSE },
        });
        return;
      }
    }

    if (!shouldPaidMessageAutoApprove && starsForAllMessages) {
      confirmPaymentHandlerRef.current = () => handler(...args);
      getActions().openPaymentMessageConfirmDialogOpen();
    } else {
      handler(...args);
    }
  };

  const dialogHandler = useLastCallback(() => {
    confirmPaymentHandlerRef.current?.();
    getActions().closePaymentMessageConfirmDialogOpen();
    if (shouldAutoApprove) getActions().setPaidMessageAutoApprove();
  });

  return {
    closeConfirmDialog,
    handleWithConfirmation,
    dialogHandler,
    shouldAutoApprove,
    setAutoApprove,
  };
}
