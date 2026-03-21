import type { ApiSavedStarGift, ApiStarGiftUnique } from '../../../api/types';
import type { ActionReturnType } from '../../types';

import { STARS_CURRENCY_CODE } from '../../../config';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import * as langProvider from '../../../util/oldLangProvider';
import { addTabStateResetterAction } from '../../helpers/meta';
import { getPrizeStarsTransactionFromGiveaway, getStarsTransactionFromGift } from '../../helpers/payments';
import { addActionHandler, setGlobal } from '../../index';
import { clearStarPayment, openStarsTransactionModal } from '../../reducers';
import { removeGiftAuction } from '../../reducers/gifts';
import { updateTabState } from '../../reducers/tabs';
import {
  selectChatMessage, selectIsCurrentUserFrozen, selectShouldRemoveGiftAuction, selectStarsPayment, selectTabState,
} from '../../selectors';

function buildShortSavedGift(gift: ApiStarGiftUnique, fromId?: string): ApiSavedStarGift {
  return {
    gift,
    date: Math.floor(Date.now() / 1000),
    fromId,
  };
}

addActionHandler('processOriginStarsPayment', (global, actions, payload): ActionReturnType => {
  const { originData, status, tabId = getCurrentTabId() } = payload;
  const {
    originStarsPayment, originReaction, originGift, topup,
  } = originData || {};

  if (!originStarsPayment && !originReaction && !originGift && !topup) {
    return undefined;
  }

  actions.closeStarsBalanceModal({ tabId });

  if (status !== 'paid') {
    return undefined;
  }

  // Re-open previous payment modal
  if (originStarsPayment) {
    global = updateTabState(global, {
      starsPayment: originStarsPayment,
    }, tabId);
  }

  if (originReaction) {
    actions.sendPaidReaction({
      chatId: originReaction.chatId,
      messageId: originReaction.messageId,
      forcedAmount: originReaction.amount,
      tabId,
    });
  }

  if (originGift) {
    actions.sendStarGift({
      ...originGift,
      tabId,
    });
  }

  return global;
});

addActionHandler('openGiftRecipientPicker', (global, actions, payload): ActionReturnType => {
  const {
    tabId = getCurrentTabId(),
  } = payload || {};

  if (selectIsCurrentUserFrozen(global)) {
    actions.openFrozenAccountModal({ tabId });
    return global;
  }

  return updateTabState(global, {
    isGiftRecipientPickerOpen: true,
  }, tabId);
});

addTabStateResetterAction('closeGiftRecipientPicker', 'isGiftRecipientPickerOpen');

addActionHandler('openStarsGiftingPickerModal', (global, actions, payload): ActionReturnType => {
  const {
    tabId = getCurrentTabId(),
  } = payload || {};

  return updateTabState(global, {
    starsGiftingPickerModal: {
      isOpen: true,
    },
  }, tabId);
});

addTabStateResetterAction('closeStarsGiftingPickerModal', 'starsGiftingPickerModal');

addActionHandler('openPrizeStarsTransactionFromGiveaway', (global, actions, payload): ActionReturnType => {
  const {
    chatId,
    messageId,
    tabId = getCurrentTabId(),
  } = payload || {};

  const message = selectChatMessage(global, chatId, messageId);
  if (!message) return undefined;

  const transaction = getPrizeStarsTransactionFromGiveaway(message);
  if (!transaction) return undefined;

  return openStarsTransactionModal(global, transaction, tabId);
});

addActionHandler('openStarsBalanceModal', (global, actions, payload): ActionReturnType => {
  const {
    originStarsPayment,
    originReaction,
    originGift,
    topup,
    shouldIgnoreBalance,
    currency = STARS_CURRENCY_CODE,
    tabId = getCurrentTabId(),
  } = payload || {};

  const starBalance = global.stars?.balance;

  if (!shouldIgnoreBalance && starBalance && topup && topup.balanceNeeded <= starBalance.amount) {
    actions.showNotification({
      message: langProvider.oldTranslate('StarsTopupLinkEnough'),
      actionText: langProvider.oldTranslate('StarsTopupLinkTopupAnyway'),
      action: {
        action: 'openStarsBalanceModal',
        payload: { topup, shouldIgnoreBalance: true, tabId },
      },
      icon: 'star',
      tabId,
    });
    return undefined;
  }

  global = clearStarPayment(global, tabId);

  // Always refresh status on opening
  actions.loadStarStatus();

  return updateTabState(global, {
    starsBalanceModal: {
      originStarsPayment,
      originReaction,
      originGift,
      topup,
      currency,
    },
  }, tabId);
});

addTabStateResetterAction('closeStarsBalanceModal', 'starsBalanceModal');

addActionHandler('closeStarsPaymentModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  const starsPayment = selectStarsPayment(global, tabId);
  let status = starsPayment?.status;
  if (!status || status === 'pending') {
    status = 'cancelled';
  }

  return updateTabState(global, {
    starsPayment: {
      status,
    },
  }, tabId);
});

addActionHandler('openStarsTransactionModal', (global, actions, payload): ActionReturnType => {
  const { transaction, tabId = getCurrentTabId() } = payload;
  return openStarsTransactionModal(global, transaction, tabId);
});

addActionHandler('openStarsTransactionFromGift', (global, actions, payload): ActionReturnType => {
  const {
    chatId,
    messageId,
    tabId = getCurrentTabId(),
  } = payload || {};

  const message = selectChatMessage(global, chatId, messageId);
  if (!message) return undefined;

  const transaction = getStarsTransactionFromGift(message);
  if (!transaction) return undefined;

  return openStarsTransactionModal(global, transaction, tabId);
});

addTabStateResetterAction('closeStarsTransactionModal', 'starsTransactionModal');

addActionHandler('openStarsSubscriptionModal', (global, actions, payload): ActionReturnType => {
  const { subscription, tabId = getCurrentTabId() } = payload;

  return updateTabState(global, {
    starsSubscriptionModal: {
      subscription,
    },
  }, tabId);
});

addTabStateResetterAction('closeStarsSubscriptionModal', 'starsSubscriptionModal');

addTabStateResetterAction('closeGiftModal', 'giftModal');

addActionHandler('setGiftModalSelectedGift', (global, actions, payload): ActionReturnType => {
  const { gift, tabId = getCurrentTabId() } = payload;

  const tabState = selectTabState(global, tabId);
  const giftModal = tabState?.giftModal;

  if (!gift) {
    const previousGift = giftModal?.selectedGift;
    const auctionGiftId = previousGift && 'id' in previousGift && previousGift.type === 'starGift'
      && previousGift.isAuction ? previousGift.id : undefined;

    if (auctionGiftId && selectShouldRemoveGiftAuction(global, auctionGiftId)) {
      global = removeGiftAuction(global, auctionGiftId);
    }
  }

  if (giftModal) {
    return updateTabState(global, {
      giftModal: {
        ...giftModal,
        selectedGift: gift,
      },
    }, tabId);
  }

  if (gift && 'id' in gift) {
    actions.openGiftModal({
      forUserId: global.currentUserId!,
      selectedGift: gift,
      tabId,
    });
  }

  return undefined;
});

addActionHandler('closeStarsGiftModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    starsGiftModal: { isOpen: false },
  }, tabId);
});

addActionHandler('openGiftInfoModal', (global, actions, payload): ActionReturnType => {
  const {
    gift, craftSlotIndex, tabId = getCurrentTabId(),
  } = payload;

  const peerId = 'peerId' in payload ? payload.peerId : undefined;
  const recipientId = 'recipientId' in payload ? payload.recipientId : undefined;

  return updateTabState(global, {
    giftInfoModal: {
      peerId,
      gift,
      recipientId,
      craftSlotIndex,
    },
  }, tabId);
});

addActionHandler('openLockedGiftModalInfo', (global, actions, payload): ActionReturnType => {
  const {
    untilDate, reason, tabId = getCurrentTabId(),
  } = payload;

  return updateTabState(global, {
    lockedGiftModal: {
      untilDate,
      reason,
    },
  }, tabId);
});

addTabStateResetterAction('closeLockedGiftModal', 'lockedGiftModal');

addActionHandler('openGiftResalePriceComposerModal', (global, actions, payload): ActionReturnType => {
  const {
    gift, peerId, tabId = getCurrentTabId(),
  } = payload;

  return updateTabState(global, {
    giftResalePriceComposerModal: {
      peerId,
      gift,
    },
  }, tabId);
});

addActionHandler('openGiftInMarket', (global, actions, payload): ActionReturnType => {
  const { gift, tabId = getCurrentTabId() } = payload;

  const giftModal = selectTabState(global, tabId).giftModal;

  actions.closeGiftInfoValueModal({ tabId });
  actions.closeGiftInfoModal({ tabId });

  if (giftModal) {
    return updateTabState(global, {
      giftModal: {
        ...giftModal,
        selectedResaleGift: gift,
      },
    }, tabId);
  }

  actions.openGiftModal({
    forUserId: global.currentUserId!,
    selectedResaleGift: gift,
    tabId,
  });

  return global;
});

addActionHandler('closeResaleGiftsMarket', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  actions.resetResaleGifts({ tabId });

  const giftModal = selectTabState(global, tabId).giftModal;

  if (giftModal) {
    return updateTabState(global, {
      giftModal: {
        ...giftModal,
        selectedResaleGift: undefined,
      },
    }, tabId);
  }

  return global;
});

addTabStateResetterAction('closeGiftInfoModal', 'giftInfoModal');

addTabStateResetterAction('closeGiftInfoValueModal', 'giftInfoValueModal');

addTabStateResetterAction('closeGiftResalePriceComposerModal', 'giftResalePriceComposerModal');

addTabStateResetterAction('closeGiftUpgradeModal', 'giftUpgradeModal');

addTabStateResetterAction('closeGiftCraftModal', 'giftCraftModal');

addTabStateResetterAction('closeGiftCraftSelectModal', 'giftCraftSelectModal');

addActionHandler('openGiftCraftInfoModal', (global, _actions, payload): ActionReturnType => {
  const { gift, tabId = getCurrentTabId() } = payload;

  return updateTabState(global, {
    giftCraftInfoModal: { gift },
  }, tabId);
});

addTabStateResetterAction('closeGiftCraftInfoModal', 'giftCraftInfoModal');

addActionHandler('selectGiftForCraft', (global, _actions, payload): ActionReturnType => {
  const { gift, slotIndex, tabId = getCurrentTabId() } = payload;

  const tabState = selectTabState(global, tabId);
  const modal = tabState.giftCraftModal;

  if (!modal) return undefined;

  const slots = [modal.gift1, modal.gift2, modal.gift3, modal.gift4];
  slots[slotIndex] = gift;

  return updateTabState(global, {
    giftCraftModal: {
      ...modal,
      gift1: slots[0],
      gift2: slots[1],
      gift3: slots[2],
      gift4: slots[3],
    },
    giftCraftSelectModal: gift ? undefined : tabState.giftCraftSelectModal,
  }, tabId);
});

addActionHandler('selectPurchasedGiftForCraft', (global, actions, payload): ActionReturnType => {
  const { giftId, slotIndex, tabId = getCurrentTabId() } = payload;

  const tabState = selectTabState(global, tabId);
  const craftModal = tabState.giftCraftModal;
  const giftInfoModal = tabState.giftInfoModal;
  if (!craftModal) return undefined;

  const giftFromModal = giftInfoModal?.gift;
  const actualGift = giftFromModal && 'gift' in giftFromModal ? giftFromModal.gift : giftFromModal;

  if (!actualGift || actualGift.type !== 'starGiftUnique' || actualGift.id !== giftId) {
    return undefined;
  }

  const shortSavedGift = buildShortSavedGift(actualGift, global.currentUserId);

  const slots = [craftModal.gift1, craftModal.gift2, craftModal.gift3, craftModal.gift4];
  slots[slotIndex] = shortSavedGift;

  global = updateTabState(global, {
    giftCraftModal: {
      ...craftModal,
      gift1: slots[0],
      gift2: slots[1],
      gift3: slots[2],
      gift4: slots[3],
      shouldRefreshMyCraftableGifts: true,
    },
  }, tabId);

  actions.closeGiftCraftSelectModal({ tabId });

  return global;
});

addActionHandler('resetGiftCraftResult', (global, _actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const modal = selectTabState(global, tabId).giftCraftModal;
  if (!modal) return undefined;

  return updateTabState(global, {
    giftCraftModal: {
      ...modal,
      craftResult: undefined,
      gift1: undefined,
      gift2: undefined,
      gift3: undefined,
      gift4: undefined,
    },
  }, tabId);
});
addTabStateResetterAction('closeGiftPreviewModal', 'giftPreviewModal');

addActionHandler('closeGiftAuctionModal', (global, _actions, payload): ActionReturnType => {
  const { shouldKeepAuction, tabId = getCurrentTabId() } = payload || {};
  const tabState = selectTabState(global, tabId);
  const giftId = tabState.giftAuctionModal?.auctionGiftId;

  global = updateTabState(global, {
    giftAuctionModal: undefined,
  }, tabId);

  if (!shouldKeepAuction && giftId && selectShouldRemoveGiftAuction(global, giftId)) {
    global = removeGiftAuction(global, giftId);
  }

  return global;
});

addActionHandler('openGiftAuctionBidModal', (global, _actions, payload): ActionReturnType => {
  const { auctionGiftId, peerId, message, shouldHideName, tabId = getCurrentTabId() } = payload;

  return updateTabState(global, {
    giftAuctionBidModal: { auctionGiftId, peerId, message, shouldHideName },
  }, tabId);
});

addActionHandler('closeGiftAuctionBidModal', (global, _actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  global = updateTabState(global, {
    giftAuctionBidModal: undefined,
  }, tabId);

  return global;
});

addActionHandler('openGiftAuctionInfoModal', (global, _actions, payload): ActionReturnType => {
  const { auctionGiftId, tabId = getCurrentTabId() } = payload;

  return updateTabState(global, {
    giftAuctionInfoModal: { auctionGiftId },
  }, tabId);
});

addActionHandler('closeGiftAuctionInfoModal', (global, _actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  global = updateTabState(global, {
    giftAuctionInfoModal: undefined,
  }, tabId);

  return global;
});

addTabStateResetterAction('closeAboutStarGiftModal', 'aboutStarGiftModal');

addActionHandler('openGiftAuctionChangeRecipientModal', (global, _actions, payload): ActionReturnType => {
  const {
    auctionGiftId, oldPeerId, newPeerId, message, shouldHideName, tabId = getCurrentTabId(),
  } = payload;

  return updateTabState(global, {
    giftAuctionChangeRecipientModal: {
      auctionGiftId, oldPeerId, newPeerId, message, shouldHideName,
    },
  }, tabId);
});

addTabStateResetterAction('closeGiftAuctionChangeRecipientModal', 'giftAuctionChangeRecipientModal');

addTabStateResetterAction('closeGiftAuctionAcquiredModal', 'giftAuctionAcquiredModal');

addActionHandler('openStarGiftPriceDecreaseInfoModal', (global, actions, payload): ActionReturnType => {
  const {
    prices, currentPrice, minPrice, maxPrice, tabId = getCurrentTabId(),
  } = payload;

  return updateTabState(global, {
    starGiftPriceDecreaseInfoModal: {
      prices,
      currentPrice,
      minPrice,
      maxPrice,
    },
  }, tabId);
});

addTabStateResetterAction('closeStarGiftPriceDecreaseInfoModal', 'starGiftPriceDecreaseInfoModal');

addActionHandler('openGiftWithdrawModal', (global, actions, payload): ActionReturnType => {
  const { gift, tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    giftWithdrawModal: {
      gift,
    },
  }, tabId);
});

addTabStateResetterAction('closeGiftWithdrawModal', 'giftWithdrawModal');

addActionHandler('openGiftStatusInfoModal', (global, actions, payload): ActionReturnType => {
  const { emojiStatus, tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    giftStatusInfoModal: {
      emojiStatus,
    },
  }, tabId);
});

addActionHandler('closeGiftStatusInfoModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    giftStatusInfoModal: undefined,
  }, tabId);
});

addActionHandler('clearGiftWithdrawError', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const tabState = selectTabState(global, tabId);
  const giftWithdrawModal = tabState?.giftWithdrawModal;
  if (!giftWithdrawModal) return undefined;

  return updateTabState(global, {
    giftWithdrawModal: {
      ...giftWithdrawModal,
      errorKey: undefined,
    },
  }, tabId);
});

addActionHandler('openGiftTransferModal', (global, actions, payload): ActionReturnType => {
  const { gift, tabId = getCurrentTabId() } = payload;

  return updateTabState(global, {
    giftTransferModal: {
      gift,
    },
  }, tabId);
});

addTabStateResetterAction('closeGiftTransferModal', 'giftTransferModal');

addActionHandler('openGiftTransferConfirmModal', (global, actions, payload): ActionReturnType => {
  const {
    gift, recipientId, tabId = getCurrentTabId(),
  } = payload;

  return updateTabState(global, {
    giftTransferConfirmModal: {
      gift,
      recipientId,
    },
  }, tabId);
});

addTabStateResetterAction('closeGiftTransferConfirmModal', 'giftTransferConfirmModal');

addActionHandler('openGiftDescriptionRemoveModal', (global, actions, payload): ActionReturnType => {
  const {
    gift, price, details, tabId = getCurrentTabId(),
  } = payload;

  return updateTabState(global, {
    giftDescriptionRemoveModal: {
      gift,
      price,
      details,
    },
  }, tabId);
});

addTabStateResetterAction('closeGiftDescriptionRemoveModal', 'giftDescriptionRemoveModal');

addActionHandler('openGiftOfferAcceptModal', (global, actions, payload): ActionReturnType => {
  const {
    peerId, messageId, gift, price, tabId = getCurrentTabId(),
  } = payload;

  return updateTabState(global, {
    giftOfferAcceptModal: {
      peerId,
      messageId,
      gift,
      price,
    },
  }, tabId);
});

addTabStateResetterAction('closeGiftOfferAcceptModal', 'giftOfferAcceptModal');

addActionHandler('updateSelectedGiftCollection', (global, actions, payload): ActionReturnType => {
  const { peerId, collectionId, tabId = getCurrentTabId() } = payload;
  const tabState = selectTabState(global, tabId);

  global = updateTabState(global, {
    savedGifts: {
      ...tabState.savedGifts,
      activeCollectionByPeerId: {
        ...tabState.savedGifts.activeCollectionByPeerId,
        [peerId]: collectionId,
      },
    },
  }, tabId);
  setGlobal(global);

  actions.loadPeerSavedGifts({
    peerId, shouldRefresh: true, tabId: tabState.id,
  });
});

addActionHandler('resetSelectedGiftCollection', (global, actions, payload): ActionReturnType => {
  const { peerId, tabId = getCurrentTabId() } = payload;
  const tabState = selectTabState(global, tabId);

  global = updateTabState(global, {
    savedGifts: {
      ...tabState.savedGifts,
      activeCollectionByPeerId: {
        ...tabState.savedGifts.activeCollectionByPeerId,
        [peerId]: undefined,
      },
    },
  }, tabId);
  setGlobal(global);

  actions.loadPeerSavedGifts({
    peerId, shouldRefresh: true, tabId: tabState.id,
  });
});

addActionHandler('openActiveGiftAuctionsModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    activeGiftAuctionsModal: true,
  }, tabId);
});

addTabStateResetterAction('closeActiveGiftAuctionsModal', 'activeGiftAuctionsModal');
