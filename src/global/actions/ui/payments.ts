import { addActionHandler } from '../../index';

import { clearPayment, closeInvoice } from '../../reducers';

addActionHandler('closePaymentModal', (global) => {
  const status = global.payment.status;
  global = clearPayment(global);
  global = closeInvoice(global);
  global = {
    ...global,
    payment: {
      ...global.payment,
      status,
    },
  };
  return global;
});

addActionHandler('addPaymentError', (global, actions, payload) => {
  const { error } = payload!;

  return {
    ...global,
    payment: {
      ...global.payment,
      status: 'failed',
      error,
    },
  };
});
