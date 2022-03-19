import { addActionHandler } from '../../index';

import { clearPayment, closeInvoice } from '../../reducers';

addActionHandler('openPaymentModal', (global, actions, payload) => {
  const { chatId, messageId } = payload;
  return {
    ...global,
    payment: {
      ...global.payment,
      chatId,
      messageId,
      isPaymentModalOpen: true,
    },
  };
});

addActionHandler('closePaymentModal', (global) => {
  global = clearPayment(global);
  global = closeInvoice(global);
  return global;
});

addActionHandler('addPaymentError', (global, actions, payload) => {
  const { error } = payload!;

  return {
    ...global,
    payment: {
      ...global.payment,
      error,
    },
  };
});
