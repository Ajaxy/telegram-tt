import type { ApiSavedGifts } from '../../../api/types';
import type { ActionReturnType } from '../../types';

import { DEFAULT_GIFT_PROFILE_FILTER_OPTIONS } from '../../../config';
import { selectActiveGiftsCollectionId } from '../../../global/selectors';
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
    && !updatedFilter.shouldIncludeUnique
    && !updatedFilter.shouldIncludeUpgradable) {
    updatedFilter = {
      ...prevFilter,
      shouldIncludeUnlimited: true,
      shouldIncludeLimited: true,
      shouldIncludeUnique: true,
      shouldIncludeUpgradable: true,
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

  const activeCollectionId = selectActiveGiftsCollectionId(global, peerId, tabId);

  global = updateTabState(global, {
    savedGifts: {
      ...tabState.savedGifts,
      collectionsByPeerId: {
        [peerId]: {
          [activeCollectionId]: tabState.savedGifts.collectionsByPeerId[peerId]?.[activeCollectionId],
        } as Record<number | 'all', ApiSavedGifts>,
      },
      filter: updatedFilter,
    },
  }, tabId);
  setGlobal(global);

  actions.loadPeerSavedGifts({
    peerId, shouldRefresh: true, tabId: tabState.id,
  });
});

addActionHandler('resetGiftProfileFilter', (global, actions, payload): ActionReturnType => {
  const { peerId, tabId = getCurrentTabId() } = payload || {};
  const tabState = selectTabState(global, tabId);

  const activeCollectionId = selectActiveGiftsCollectionId(global, peerId, tabId);

  global = updateTabState(global, {
    savedGifts: {
      ...tabState.savedGifts,
      collectionsByPeerId: {
        [peerId]: {
          [activeCollectionId]: tabState.savedGifts.collectionsByPeerId[peerId]?.[activeCollectionId],
        } as Record<number | 'all', ApiSavedGifts>,
      },
      filter: {
        ...DEFAULT_GIFT_PROFILE_FILTER_OPTIONS,
      },
    },
  }, tabId);
  setGlobal(global);

  actions.loadPeerSavedGifts({
    peerId, shouldRefresh: true, tabId: tabState.id,
  });
});

addActionHandler('openPaymentMessageConfirmDialogOpen', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    isPaymentMessageConfirmDialogOpen: true,
  }, tabId);
});

addActionHandler('closePaymentMessageConfirmDialogOpen', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    isPaymentMessageConfirmDialogOpen: false,
  }, tabId);
});

addActionHandler('openPriceConfirmModal', (global, actions, payload): ActionReturnType => {
  const {
    originalAmount,
    newAmount,
    currency,
    directInfo,
    tabId = getCurrentTabId(),
  } = payload;

  return updateTabState(global, {
    priceConfirmModal: {
      originalAmount,
      newAmount,
      currency,
      directInfo,
    },
  }, tabId);
});

addActionHandler('closePriceConfirmModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    priceConfirmModal: undefined,
  }, tabId);
});
