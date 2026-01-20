import { getPromiseActions } from '../../../global';

import type { ApiInputSavedStarGift, ApiSavedStarGift } from '../../../api/types';
import type { ActionReturnType } from '../../types';

import { STARS_CURRENCY_CODE } from '../../../config';
import { selectChat } from '../../../global/selectors';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import * as langProvider from '../../../util/oldLangProvider';
import { callApi } from '../../../api/gramjs';
import { addTabStateResetterAction } from '../../helpers/meta';
import { getPrizeStarsTransactionFromGiveaway, getStarsTransactionFromGift } from '../../helpers/payments';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { clearStarPayment, openStarsTransactionModal } from '../../reducers';
import { removeGiftAuction } from '../../reducers/gifts';
import { updateTabState } from '../../reducers/tabs';
import {
  selectChatMessage, selectIsCurrentUserFrozen, selectShouldRemoveGiftAuction, selectStarsPayment, selectTabState,
} from '../../selectors';

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

addActionHandler('openGiftInfoModalFromMessage', async (global, actions, payload): Promise<void> => {
  const {
    chatId, messageId, tabId = getCurrentTabId(),
  } = payload;

  const chat = selectChat(global, chatId);
  if (!chat) return;

  await getPromiseActions().loadMessage({ chatId, messageId });

  global = getGlobal();
  const message = selectChatMessage(global, chatId, messageId);

  if (!message || !message.content.action) return;

  const action = message.content.action;
  if (action.type !== 'starGift' && action.type !== 'starGiftUnique') return;

  const starGift = action.type === 'starGift' ? action : undefined;
  const uniqueGift = action.type === 'starGiftUnique' ? action : undefined;
  const giftMsgId = starGift?.giftMsgId;

  const giftReceiverId = action.peerId || (message.isOutgoing ? message.chatId : global.currentUserId!);

  const inputGift: ApiInputSavedStarGift = (() => {
    if (giftMsgId) {
      return { type: 'user', messageId: giftMsgId };
    }
    if (action.savedId) {
      return { type: 'chat', chatId, savedId: action.savedId };
    }
    return { type: 'user', messageId };
  })();

  const fromId = action.fromId || (message.isOutgoing ? global.currentUserId! : message.chatId);

  const gift: ApiSavedStarGift = {
    date: message.date,
    gift: action.gift,
    message: starGift?.message,
    starsToConvert: starGift?.starsToConvert,
    isNameHidden: starGift?.isNameHidden,
    isUnsaved: !action.isSaved,
    fromId,
    messageId: message.id,
    isConverted: starGift?.isConverted,
    upgradeMsgId: starGift?.upgradeMsgId,
    canUpgrade: starGift?.canUpgrade,
    alreadyPaidUpgradeStars: starGift?.alreadyPaidUpgradeStars,
    inputGift,
    canExportAt: uniqueGift?.canExportAt,
    savedId: action.savedId,
    transferStars: uniqueGift?.transferStars,
    dropOriginalDetailsStars: uniqueGift?.dropOriginalDetailsStars,
    prepaidUpgradeHash: starGift?.prepaidUpgradeHash,
  };

  actions.openGiftInfoModal({ peerId: giftReceiverId, gift, tabId });
});

addActionHandler('openGiftInfoModal', (global, actions, payload): ActionReturnType => {
  const {
    gift, tabId = getCurrentTabId(),
  } = payload;

  const peerId = 'peerId' in payload ? payload.peerId : undefined;
  const recipientId = 'recipientId' in payload ? payload.recipientId : undefined;

  return updateTabState(global, {
    giftInfoModal: {
      peerId,
      gift,
      recipientId,
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

addActionHandler('openGiftInfoValueModal', async (global, actions, payload): Promise<void> => {
  const { gift, tabId = getCurrentTabId() } = payload;

  const result = await callApi('fetchUniqueStarGiftValueInfo', { slug: gift.slug });
  if (!result) return;

  global = getGlobal();
  global = updateTabState(global, {
    giftInfoValueModal: {
      valueInfo: result,
      gift,
    },
  }, tabId);
  setGlobal(global);
});

addTabStateResetterAction('closeGiftInfoModal', 'giftInfoModal');

addTabStateResetterAction('closeGiftInfoValueModal', 'giftInfoValueModal');

addTabStateResetterAction('closeGiftResalePriceComposerModal', 'giftResalePriceComposerModal');

addTabStateResetterAction('closeGiftUpgradeModal', 'giftUpgradeModal');

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

addActionHandler('openAboutStarGiftModal', async (global, _actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId() } = payload || {};

  const result = await callApi('fetchPremiumPromo');

  let videoId: string | undefined;
  let videoThumbnail;

  if (result?.promo) {
    const giftsIndex = result.promo.videoSections.indexOf('gifts');
    if (giftsIndex !== -1 && giftsIndex < result.promo.videos.length) {
      const video = result.promo.videos[giftsIndex];
      videoId = video.id;
      videoThumbnail = video.thumbnail;
    }
  }

  global = getGlobal();
  global = updateTabState(global, {
    aboutStarGiftModal: { videoId, videoThumbnail },
  }, tabId);
  setGlobal(global);
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
