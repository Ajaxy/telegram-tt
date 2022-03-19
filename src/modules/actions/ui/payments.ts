import { addActionHandler } from '../..';

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
  const newGlobal = clearPayment(global);
  return closeInvoice(newGlobal);
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
