import type { ApiMessageActionStarGift, ApiSavedStarGift } from '../../../api/types';
import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import * as langProvider from '../../../util/oldLangProvider';
import { getPrizeStarsTransactionFromGiveaway, getStarsTransactionFromGift } from '../../helpers/payments';
import { addActionHandler } from '../../index';
import {
  clearStarPayment, openStarsTransactionModal,
} from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import { selectChatMessage, selectStarsPayment, selectTabState } from '../../selectors';

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

  return updateTabState(global, {
    isGiftRecipientPickerOpen: true,
  }, tabId);
});

addActionHandler('closeGiftRecipientPicker', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    isGiftRecipientPickerOpen: undefined,
  }, tabId);
});

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

addActionHandler('closeStarsGiftingPickerModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    starsGiftingPickerModal: undefined,
  }, tabId);
});

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
    },
  }, tabId);
});

addActionHandler('closeStarsBalanceModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    starsBalanceModal: undefined,
  }, tabId);
});

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

addActionHandler('closeStarsTransactionModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    starsTransactionModal: undefined,
  }, tabId);
});

addActionHandler('openStarsSubscriptionModal', (global, actions, payload): ActionReturnType => {
  const { subscription, tabId = getCurrentTabId() } = payload;

  return updateTabState(global, {
    starsSubscriptionModal: {
      subscription,
    },
  }, tabId);
});

addActionHandler('closeStarsSubscriptionModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    starsSubscriptionModal: undefined,
  }, tabId);
});

addActionHandler('closeGiftModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    giftModal: undefined,
  }, tabId);
});

addActionHandler('closeStarsGiftModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    starsGiftModal: { isOpen: false },
  }, tabId);
});

addActionHandler('openGiftInfoModalFromMessage', (global, actions, payload): ActionReturnType => {
  const {
    chatId, messageId, tabId = getCurrentTabId(),
  } = payload;

  const message = selectChatMessage(global, chatId, messageId);
  if (!message || !message.content.action) return;

  const action = message.content.action;
  if (action.type === 'starGiftUnique') {
    actions.openGiftInfoModal({ gift: action.starGift?.gift!, tabId });
    return;
  }

  if (action.type !== 'starGift') return;

  const starGift = action.starGift! as ApiMessageActionStarGift;

  const giftReceiverId = message.isOutgoing ? message.chatId : global.currentUserId!;

  const gift = {
    date: message.date,
    gift: starGift.gift,
    message: starGift.message,
    starsToConvert: starGift.starsToConvert,
    isNameHidden: starGift.isNameHidden,
    isUnsaved: !starGift.isSaved,
    fromId: message.isOutgoing ? global.currentUserId : message.chatId,
    messageId: (!message.isOutgoing || chatId === global.currentUserId) ? message.id : undefined,
    isConverted: starGift.isConverted,
    upgradeMsgId: starGift.upgradeMsgId,
    canUpgrade: starGift.canUpgrade,
    alreadyPaidUpgradeStars: starGift.alreadyPaidUpgradeStars,
    inputGift: starGift.inputSavedGift,
  } satisfies ApiSavedStarGift;

  actions.openGiftInfoModal({ peerId: giftReceiverId, gift, tabId });
});

addActionHandler('openGiftInfoModal', (global, actions, payload): ActionReturnType => {
  const {
    gift, tabId = getCurrentTabId(),
  } = payload;

  const peerId = 'peerId' in payload ? payload.peerId : undefined;

  return updateTabState(global, {
    giftInfoModal: {
      peerId,
      gift,
    },
  }, tabId);
});

addActionHandler('closeGiftInfoModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    giftInfoModal: undefined,
  }, tabId);
});

addActionHandler('closeGiftUpgradeModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    giftUpgradeModal: undefined,
  }, tabId);
});

addActionHandler('openGiftWithdrawModal', (global, actions, payload): ActionReturnType => {
  const { gift, tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    giftWithdrawModal: {
      gift,
    },
  }, tabId);
});

addActionHandler('closeGiftWithdrawModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    giftWithdrawModal: undefined,
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
