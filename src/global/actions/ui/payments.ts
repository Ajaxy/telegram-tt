import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { addActionHandler } from '../../index';
import {
  clearPayment, closeInvoice, openStarsTransactionModal, updatePayment,
} from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import { selectTabState } from '../../selectors';

addActionHandler('closePaymentModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const payment = selectTabState(global, tabId).payment;
  const status = payment.status || 'cancelled';
  const starsBalanceModal = selectTabState(global, tabId).starsBalanceModal;
  const originPayment = starsBalanceModal?.originPayment;
  const originReaction = starsBalanceModal?.originReaction;

  global = clearPayment(global, tabId);
  global = closeInvoice(global, tabId);
  global = updateTabState(global, {
    payment: {
      ...selectTabState(global, tabId).payment,
      status,
    },
    ...((originPayment || originReaction) && {
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

  // Send reaction
  if (originReaction) {
    actions.sendPaidReaction({
      chatId: originReaction.chatId,
      messageId: originReaction.messageId,
      forcedAmount: originReaction.amount,
      tabId,
    });
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
  const { originPayment, originReaction, tabId = getCurrentTabId() } = payload || {};

  global = clearPayment(global, tabId);

  // Always refresh status on opening
  actions.loadStarStatus();

  return updateTabState(global, {
    starsBalanceModal: {
      originPayment,
      originReaction,
    },
  }, tabId);
});

addActionHandler('closeStarsBalanceModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    starsBalanceModal: undefined,
  }, tabId);
});

addActionHandler('openStarsTransactionModal', (global, actions, payload): ActionReturnType => {
  const { transaction, tabId = getCurrentTabId() } = payload;
  return openStarsTransactionModal(global, transaction, tabId);
});

addActionHandler('closeStarsTransactionModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    starsTransactionModal: undefined,
  }, tabId);
});
