import { addActionHandler } from '../../index';

import { clearPayment } from '../../reducers';

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update['@type']) {
    case 'updatePaymentStateCompleted': {
      const { inputInvoice } = global.payment;
      if (update.slug && inputInvoice && 'slug' in inputInvoice && inputInvoice.slug !== update.slug) {
        return undefined;
      }
      global = clearPayment(global);
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
