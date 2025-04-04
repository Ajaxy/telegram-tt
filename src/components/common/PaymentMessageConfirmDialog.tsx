import type { FC, StateHookSetter } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import useLang from '../../hooks/useLang';

import Checkbox from '../ui/Checkbox';
import ConfirmDialog from '../ui/ConfirmDialog';

import styles from './PaymentMessageConfirmDialog.module.scss';

type OwnProps = {
  isOpen: boolean;
  onClose: NoneToVoidFunction;
  userName?: string;
  messagePriceInStars: number;
  messagesCount: number;
  shouldAutoApprove: boolean;
  setAutoApprove: StateHookSetter<boolean>;
  confirmHandler: NoneToVoidFunction;
};

const PaymentMessageConfirmDialog: FC<OwnProps> = ({
  isOpen,
  onClose,
  userName,
  messagePriceInStars,
  messagesCount,
  shouldAutoApprove: shouldPaidMessageAutoApprove,
  setAutoApprove: setShouldPaidMessageAutoApprove,
  confirmHandler,
}) => {
  const lang = useLang();

  const confirmPaymentMessage = messagesCount === 1 ? lang('ConfirmationModalPaymentForOneMessage', {
    user: userName,
    amount: messagePriceInStars,
  }, {
    withMarkdown: true,
    withNodes: true,
  }) : lang('ConfirmationModalPaymentForMessages', {
    user: userName,
    price: messagePriceInStars,
    amount: messagePriceInStars * messagesCount,
    count: messagesCount,
  }, {
    withMarkdown: true,
    withNodes: true,
  });

  const confirmLabel = lang('ButtonPayForMessage', { count: messagesCount }, {
    withNodes: true,
  });

  return (
    <ConfirmDialog
      title={lang('TitleConfirmPayment')}
      confirmLabel={confirmLabel}
      isOpen={isOpen}
      onClose={onClose}
      confirmHandler={confirmHandler}
    >
      {confirmPaymentMessage}
      <Checkbox
        className={styles.checkBox}
        label={lang('DoNotAskAgain')}
        checked={shouldPaidMessageAutoApprove}
        onCheck={setShouldPaidMessageAutoApprove}
      />
    </ConfirmDialog>
  );
};

export default memo(PaymentMessageConfirmDialog);
