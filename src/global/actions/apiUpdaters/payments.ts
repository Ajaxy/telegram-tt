import { addActionHandler } from '../../index';

import { IS_PRODUCTION_HOST } from '../../../util/environment';
import { clearPayment } from '../../reducers';

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update['@type']) {
    case 'updatePaymentStateCompleted': {
      const { inputInvoice } = global.payment;
      // On the production host, the payment frame receives a message with the payment event,
      // after which the payment form closes. In other cases, the payment form must be closed manually.
      if (!IS_PRODUCTION_HOST) {
        global = clearPayment(global);
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
