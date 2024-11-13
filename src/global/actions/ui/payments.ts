import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { addActionHandler } from '../../index';
import {
  clearPayment,
  updatePayment,
  updateStarsPayment,
} from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import { selectTabState } from '../../selectors';

addActionHandler('closePaymentModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const payment = selectTabState(global, tabId).payment;
  const status = payment.status || 'cancelled';
  const starsBalanceModal = selectTabState(global, tabId).starsBalanceModal;

  actions.processOriginStarsPayment({
    originData: starsBalanceModal,
    status,
    tabId,
  });

  global = clearPayment(global, tabId);
  global = updatePayment(global, {
    status,
  }, tabId);

  return global;
});

addActionHandler('resetPaymentStatus', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  global = updatePayment(global, { status: undefined }, tabId);
  global = updateStarsPayment(global, { status: undefined }, tabId);
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

addActionHandler('closeGiveawayModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    giveawayModal: undefined,
  }, tabId);
});

addActionHandler('closeGiftCodeModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    giftCodeModal: undefined,
  }, tabId);
});
