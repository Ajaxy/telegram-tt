import type { ActionReturnType } from '../../types';

import { areDeepEqual } from '../../../util/areDeepEqual';
import { formatCurrency } from '../../../util/formatCurrency';
import * as langProvider from '../../../util/langProvider';
import { IS_PRODUCTION_HOST } from '../../../util/windowEnvironment';
import { addActionHandler, setGlobal } from '../../index';
import { closeInvoice } from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import { selectChatMessage, selectTabState } from '../../selectors';

addActionHandler('apiUpdate', (global, actions, update): ActionReturnType => {
  switch (update['@type']) {
    case 'updatePaymentStateCompleted': {
      Object.values(global.byTabId).forEach(({ id: tabId }) => {
        const { inputInvoice } = selectTabState(global, tabId).payment;

        if (inputInvoice && 'chatId' in inputInvoice && 'messageId' in inputInvoice) {
          const message = selectChatMessage(global, inputInvoice.chatId, inputInvoice.messageId);

          if (message && message.content.invoice) {
            const { amount, currency, title } = message.content.invoice;

            actions.showNotification({
              tabId,
              message: langProvider.translate('PaymentInfoHint', [
                formatCurrency(amount, currency, langProvider.getTranslationFn().code),
                title,
              ]),
            });
          }
        }

        if (inputInvoice && inputInvoice.type === 'giftcode') {
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
            setGlobal(global);
          }
        }

        // On the production host, the payment frame receives a message with the payment event,
        // after which the payment form closes. In other cases, the payment form must be closed manually.
        // Closing the invoice will cause the closing of the Payment Modal dialog and then closing the payment.
        if (!IS_PRODUCTION_HOST) {
          global = closeInvoice(global, tabId);
        }

        if (update.slug && inputInvoice && 'slug' in inputInvoice && inputInvoice.slug !== update.slug) {
          return;
        }

        global = updateTabState(global, {
          payment: {
            ...selectTabState(global, tabId).payment,
            status: 'paid',
          },
        }, tabId);
      });
    }
  }

  return undefined;
});
