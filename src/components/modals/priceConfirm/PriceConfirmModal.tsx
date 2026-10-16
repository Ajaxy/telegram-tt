import { memo, useCallback } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiStarsAmount, ApiTonAmount } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { TON_CURRENCY_CODE } from '../../../config';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { formatCurrencyAmountAsText } from '../../../util/localization/format';

import useLang from '../../../hooks/useLang';

import ConfirmDialog from '../../ui/ConfirmDialog';

export type OwnProps = {
  modal: TabState['priceConfirmModal'];
};

type StateProps = {
  starBalance?: ApiStarsAmount;
  tonBalance?: ApiTonAmount;
};

const PriceConfirmModal = ({
  modal,
  starBalance,
  tonBalance,
}: OwnProps & StateProps) => {
  const actions = getActions();

  const lang = useLang();

  const handleConfirm = useCallback(() => {
    if (!modal?.directInfo) {
      actions.closePriceConfirmModal();
      return;
    }

    const { newAmount } = modal;
    const currentBalance = newAmount.currency === TON_CURRENCY_CODE ? tonBalance : starBalance;

    if (currentBalance === undefined) {
      actions.closePriceConfirmModal();
      return;
    }

    if (currentBalance.amount < newAmount.amount) {
      actions.openStarsBalanceModal({
        currency: newAmount.currency,
        tabId: getCurrentTabId(),
      });
      actions.closePriceConfirmModal();
      return;
    }

    actions.sendStarPaymentForm({
      directInfo: modal.directInfo,
      tabId: getCurrentTabId(),
    });
    actions.closePriceConfirmModal();
  }, [modal, starBalance, tonBalance, actions]);

  const handleClose = useCallback(() => {
    actions.closePriceConfirmModal();
  }, [actions]);

  if (!modal) {
    return undefined;
  }

  return (
    <ConfirmDialog
      isOpen={Boolean(modal)}
      onClose={handleClose}
      title={lang('PriceChanged')}
      confirmHandler={handleConfirm}
      confirmLabel={lang('PayNewPrice')}
    >
      <p>
        {lang('PriceChangedText', {
          originalAmount: formatCurrencyAmountAsText(lang, modal.originalAmount),
          newAmount: formatCurrencyAmountAsText(lang, modal.newAmount),
        }, {
          withMarkdown: true,
          withNodes: true,
        })}
      </p>
    </ConfirmDialog>
  );
};

export default memo(withGlobal<OwnProps>((global): Complete<StateProps> => {
  const starBalance = global.stars?.balance;
  const tonBalance = global.ton?.balance;

  return {
    starBalance,
    tonBalance,
  };
},
)(PriceConfirmModal));
