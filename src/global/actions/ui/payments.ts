import { addActionHandler } from '../../index';

import { clearPayment, closeInvoice } from '../../reducers';
import type { ActionReturnType } from '../../types';
import { selectTabState } from '../../selectors';
import { updateTabState } from '../../reducers/tabs';
import { getCurrentTabId } from '../../../util/establishMultitabRole';

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
