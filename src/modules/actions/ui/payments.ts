import { addReducer } from '../../../lib/teact/teactn';
import {
  clearPayment, closeInvoice,
} from '../../reducers';

addReducer('openPaymentModal', (global, actions, payload) => {
  const { messageId } = payload;
  return {
    ...global,
    payment: {
      ...global.payment,
      messageId,
      isPaymentModalOpen: true,
    },
  };
});

addReducer('closePaymentModal', (global) => {
  const newGlobal = clearPayment(global);
  return closeInvoice(newGlobal);
});
