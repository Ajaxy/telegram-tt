import { addActionHandler } from '../../index';

import { IS_PRODUCTION_HOST } from '../../../util/environment';
import { closeInvoice } from '../../reducers';
import * as langProvider from '../../../util/langProvider';
import { formatCurrency } from '../../../util/formatCurrency';
import { selectChatMessage } from '../../selectors';

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update['@type']) {
    case 'updatePaymentStateCompleted': {
      const { inputInvoice } = global.payment;

      if (inputInvoice && 'chatId' in inputInvoice && 'messageId' in inputInvoice) {
        const message = selectChatMessage(global, inputInvoice.chatId, inputInvoice.messageId);

        if (message && message.content.invoice) {
          const { amount, currency, title } = message.content.invoice;

          actions.showNotification({
            message: langProvider.getTranslation('PaymentInfoHint', [
              formatCurrency(amount, currency, langProvider.getTranslation.code),
              title,
            ]),
          });
        }
      }

      // On the production host, the payment frame receives a message with the payment event,
      // after which the payment form closes. In other cases, the payment form must be closed manually.
      // Closing the invoice will cause the closing of the Payment Modal dialog and then closing the payment.
      if (!IS_PRODUCTION_HOST) {
        global = closeInvoice(global);
      }

      if (update.slug && inputInvoice && 'slug' in inputInvoice && inputInvoice.slug !== update.slug) {
        return !IS_PRODUCTION_HOST ? global : undefined;
      }

      return {
        ...global,
        payment: {
          ...global.payment,
          status: 'paid',
        },
      };
    }
  }

  return undefined;
});
