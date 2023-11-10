import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { addActionHandler } from '../../index';
import { clearPayment, closeInvoice } from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import { selectTabState } from '../../selectors';

addActionHandler('closePaymentModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const status = selectTabState(global, tabId).payment.status;
  global = clearPayment(global, tabId);
  global = closeInvoice(global, tabId);
  global = updateTabState(global, {
    payment: {
      ...selectTabState(global, tabId).payment,
      status,
    },
  }, tabId);
  return global;
});

addActionHandler('addPaymentError', (global, actions, payload): ActionReturnType => {
  const { error, tabId = getCurrentTabId() } = payload;

  return updateTabState(global, {
    payment: {
      ...selectTabState(global, tabId).payment,
      status: 'failed',
      error,
    },
  }, tabId);
});

addActionHandler('closeGiftCodeModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    giftCodeModal: undefined,
  }, tabId);
});
