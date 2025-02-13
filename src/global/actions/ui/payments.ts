import type { ActionReturnType } from '../../types';

import { DEFAULT_GIFT_PROFILE_FILTER_OPTIONS } from '../../../config';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { addActionHandler, setGlobal } from '../../index';
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

addActionHandler('updateGiftProfileFilter', (global, actions, payload): ActionReturnType => {
  const { filter, peerId, tabId = getCurrentTabId() } = payload || {};
  const tabState = selectTabState(global, tabId);

  const prevFilter = tabState.savedGifts.filter;
  let updatedFilter = {
    ...prevFilter,
    ...filter,
  };

  if (!updatedFilter.shouldIncludeUnlimited
    && !updatedFilter.shouldIncludeLimited
    && !updatedFilter.shouldIncludeUnique) {
    updatedFilter = {
      ...prevFilter,
      shouldIncludeUnlimited: true,
      shouldIncludeLimited: true,
      shouldIncludeUnique: true,
      ...filter,
    };
  }

  if (!updatedFilter.shouldIncludeDisplayed && !updatedFilter.shouldIncludeHidden) {
    updatedFilter = {
      ...prevFilter,
      shouldIncludeDisplayed: true,
      shouldIncludeHidden: true,
      ...filter,
    };
  }

  global = updateTabState(global, {
    savedGifts: {
      ...tabState.savedGifts,
      giftsByPeerId: {
        [peerId]: tabState.savedGifts.giftsByPeerId[peerId],
      },
      filter: updatedFilter,
    },
  }, tabId);
  setGlobal(global);

  actions.loadPeerSavedGifts({
    peerId, shouldRefresh: true, withTransition: true, tabId: tabState.id,
  });
});

addActionHandler('resetGiftProfileFilter', (global, actions, payload): ActionReturnType => {
  const { peerId, tabId = getCurrentTabId() } = payload || {};
  const tabState = selectTabState(global, tabId);

  global = updateTabState(global, {
    savedGifts: {
      ...tabState.savedGifts,
      giftsByPeerId: {
        [peerId]: tabState.savedGifts.giftsByPeerId[peerId],
      },
      filter: {
        ...DEFAULT_GIFT_PROFILE_FILTER_OPTIONS,
      },
    },
  }, tabId);
  setGlobal(global);

  actions.loadPeerSavedGifts({
    peerId, shouldRefresh: true, withTransition: true, tabId: tabState.id,
  });
});
