import { addReducer } from '../..';

import { clearPayment, closeInvoice } from '../../reducers';

addReducer('openPaymentModal', (global, actions, payload) => {
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

addReducer('closePaymentModal', (global) => {
  const newGlobal = clearPayment(global);
  return closeInvoice(newGlobal);
});

addReducer('addPaymentError', (global, actions, payload) => {
  const { error } = payload!;

  return {
    ...global,
    payment: {
      ...global.payment,
      error,
    },
  };
});
