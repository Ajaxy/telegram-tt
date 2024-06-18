import type { ActionReturnType } from '../../types';

import { areDeepEqual } from '../../../util/areDeepEqual';
import { formatCurrencyAsString } from '../../../util/formatCurrency';
import * as langProvider from '../../../util/oldLangProvider';
import { addActionHandler, setGlobal } from '../../index';
import { closeInvoice, updateStarsBalance } from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import { selectTabState } from '../../selectors';

addActionHandler('apiUpdate', (global, actions, update): ActionReturnType => {
  switch (update['@type']) {
    case 'updatePaymentStateCompleted': {
      Object.values(global.byTabId).forEach(({ id: tabId }) => {
        const { inputInvoice, invoice } = selectTabState(global, tabId).payment;

        if (!areDeepEqual(inputInvoice, update.inputInvoice)) return;

        if (invoice) {
          const { amount, currency, title } = invoice;

          actions.showNotification({
            tabId,
            message: langProvider.oldTranslate('PaymentInfoHint', [
              formatCurrencyAsString(amount, currency, langProvider.getTranslationFn().code),
              title,
            ]),
          });
        }

        if (inputInvoice?.type === 'giftcode') {
          if (!inputInvoice.userIds) {
            return;
          }
          const giftModalState = selectTabState(global, tabId).giftPremiumModal;

          if (giftModalState && giftModalState.isOpen
            && areDeepEqual(inputInvoice.userIds, giftModalState.forUserIds)) {
            global = updateTabState(global, {
              giftPremiumModal: {
                ...giftModalState,
                isCompleted: true,
              },
            }, tabId);
            global = closeInvoice(global, tabId);
          }
        }

        setGlobal(global);
      });

      break;
    }

    case 'updateStarsBalance': {
      const stars = global.stars;
      if (!stars) {
        return;
      }

      global = updateStarsBalance(global, update.balance);

      setGlobal(global);

      actions.loadStarStatus();
      break;
    }
  }
});
