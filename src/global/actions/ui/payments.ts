import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { addActionHandler } from '../../index';
import { clearPayment, closeInvoice, updatePayment } from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import { selectTabState } from '../../selectors';

addActionHandler('closePaymentModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const payment = selectTabState(global, tabId).payment;
  const status = payment.status || 'cancelled';
  const originPayment = selectTabState(global, tabId).starsBalanceModal?.originPayment;
  global = clearPayment(global, tabId);
  global = closeInvoice(global, tabId);
  global = updateTabState(global, {
    payment: {
      ...selectTabState(global, tabId).payment,
      status,
    },
    ...(originPayment && {
      starsBalanceModal: undefined,
    }),
  }, tabId);

  // Re-open previous payment modal
  if (originPayment) {
    global = updatePayment(global, originPayment, tabId);
    global = updateTabState(global, {
      isStarPaymentModalOpen: true,
    }, tabId);
  }
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

addActionHandler('openStarsBalanceModal', (global, actions, payload): ActionReturnType => {
  const { originPayment, tabId = getCurrentTabId() } = payload || {};

  global = clearPayment(global, tabId);

  return updateTabState(global, {
    starsBalanceModal: {
      originPayment,
    },
  }, tabId);
});

addActionHandler('closeStarsBalanceModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    starsBalanceModal: undefined,
  }, tabId);
});
