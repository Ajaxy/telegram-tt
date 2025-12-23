import type { ActionReturnType } from '../../types';

import { formatCurrencyAsString } from '../../../util/formatCurrency';
import * as langProvider from '../../../util/oldLangProvider';
import { getPeerTitle } from '../../helpers/peers';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  removeGiftInfoOriginalDetails,
  updateActiveGiftAuctionState,
  updateActiveGiftAuctionUserState,
  updateStarsBalance,
} from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import { selectPeer, selectTabState } from '../../selectors';

addActionHandler('apiUpdate', (global, actions, update): ActionReturnType => {
  switch (update['@type']) {
    case 'updatePaymentStateCompleted': {
      const { paymentState, tabId } = update;
      const form = paymentState.form!;
      const { invoice } = form;

      const { totalAmount, currency } = invoice;
      const inputInvoice = paymentState.inputInvoice;
      if (inputInvoice?.type === 'stars') {
        actions.closeStarsBalanceModal({ tabId });
        actions.showNotification({
          message: langProvider.oldTranslate('StarsAcquiredInfo', inputInvoice.stars),
          title: langProvider.oldTranslate('StarsAcquired'),
          icon: 'star',
          tabId,
        });
        actions.requestConfetti({ withStars: true, tabId });
      } else if (inputInvoice?.type === 'giftcode') {
        const giftModalState = selectTabState(global, tabId).giftModal;

        if (giftModalState && inputInvoice?.userIds[0] === giftModalState.forPeerId) {
          actions.showNotification({
            message: {
              key: 'GiftSent',
            },
            tabId,
          });
          actions.requestConfetti({ withStars: true, tabId });
          actions.closeGiftModal({ tabId });
        }
      } else {
        actions.showNotification({
          tabId,
          message: langProvider.oldTranslate('PaymentInfoHint', [
            formatCurrencyAsString(totalAmount, currency, langProvider.getTranslationFn().code),
            form.title,
          ]),
        });
      }

      setGlobal(global);

      break;
    }

    case 'updateStarPaymentStateCompleted': {
      const { paymentState, tabId } = update;
      const { inputInvoice, subscriptionInfo, form } = paymentState;
      if (inputInvoice?.type === 'chatInviteSubscription' && subscriptionInfo) {
        const amount = subscriptionInfo.subscriptionPricing!.amount;

        actions.showNotification({
          tabId,
          title: langProvider.oldTranslate('StarsSubscriptionCompleted'),
          message: langProvider.oldTranslate('StarsSubscriptionCompletedText', [
            amount,
            subscriptionInfo.title,
          ], undefined, amount),
          icon: 'star',
        });
      }

      if (form?.invoice.subscriptionPeriod) {
        const amount = form.invoice.totalAmount;
        actions.showNotification({
          tabId,
          title: langProvider.oldTranslate('StarsSubscriptionCompleted'),
          message: langProvider.oldTranslate('StarsSubscriptionCompletedText', [
            amount,
            form.title,
          ], undefined, amount),
          icon: 'star',
        });
      }

      if (inputInvoice?.type === 'giftcode') {
        if (!inputInvoice.userIds) {
          return;
        }
        const giftModalState = selectTabState(global, tabId).giftModal;

        if (giftModalState && inputInvoice.userIds[0] === giftModalState.forPeerId) {
          actions.showNotification({
            message: {
              key: 'StarsGiftCompleted',
            },
            tabId,
          });
          actions.requestConfetti({ withStars: true, tabId });
          actions.closeGiftModal({ tabId });
        }
      }

      if (inputInvoice?.type === 'premiumGiftStars') {
        const giftModalState = selectTabState(global, tabId).giftModal;

        if (giftModalState && inputInvoice.userId === giftModalState.forPeerId) {
          actions.showNotification({
            message: {
              key: 'StarsGiftCompleted',
            },
            tabId,
          });
          actions.requestConfetti({ withStars: true, tabId });
          actions.closeGiftModal({ tabId });
        }
      }

      if (inputInvoice?.type === 'starsgift') {
        if (!inputInvoice.userId) {
          return;
        }
        const starsModalState = selectTabState(global, tabId).starsGiftModal;

        if (starsModalState?.isOpen && inputInvoice.userId === starsModalState.forUserId) {
          global = updateTabState(global, {
            starsGiftModal: {
              ...starsModalState,
              isCompleted: true,
            },
          }, tabId);
        }
      }

      if (inputInvoice?.type === 'stargift') {
        if (!inputInvoice.peerId) {
          return;
        }

        const starGiftModalState = selectTabState(global, tabId).giftModal;

        if (starGiftModalState && inputInvoice.peerId === starGiftModalState.forPeerId) {
          actions.showNotification({
            message: {
              key: 'StarsGiftCompleted',
            },
            tabId,
          });
          actions.reloadPeerSavedGifts({ peerId: starGiftModalState.forPeerId });
          actions.requestConfetti({ withStars: true, tabId });
          actions.closeGiftModal({ tabId });
        }
      }

      if (inputInvoice?.type === 'stargiftResale') {
        const starGiftModalState = selectTabState(global, tabId).giftInfoModal;

        if (starGiftModalState) {
          actions.showNotification({
            message: {
              key: 'StarsGiftBought',
            },
            tabId,
          });
          if (starGiftModalState.peerId) {
            actions.reloadPeerSavedGifts({ peerId: starGiftModalState.peerId });
          }
          actions.reloadPeerSavedGifts({ peerId: inputInvoice.peerId });
          actions.requestConfetti({ withStars: true, tabId });
          actions.closeGiftInfoModal({ tabId });
        }
      }

      if (inputInvoice?.type === 'stargiftUpgrade' && global.currentUserId) {
        actions.reloadPeerSavedGifts({ peerId: global.currentUserId });
      }

      if (inputInvoice?.type === 'stargiftDropOriginalDetails') {
        global = getGlobal();
        global = removeGiftInfoOriginalDetails(global, tabId);
        setGlobal(global);

        actions.closeGiftDescriptionRemoveModal({ tabId });
        actions.showNotification({
          message: { key: 'RemoveGiftDescriptionSuccessMessage' },
          tabId,
        });

        if (global.currentUserId) {
          actions.reloadPeerSavedGifts({ peerId: global.currentUserId });
        }
      }

      if (inputInvoice?.type === 'stargiftPrepaidUpgrade') {
        actions.reloadPeerSavedGifts({ peerId: inputInvoice.peerId });

        const lang = langProvider.getTranslationFn();
        const peer = selectPeer(global, inputInvoice.peerId);
        const peerTitle = peer ? getPeerTitle(lang, peer) : undefined;

        actions.showNotification({
          icon: 'gift',
          title: { key: 'GiftUpgradeSentTitle' },
          message: {
            key: 'GiftUpgradeSentMessage',
            variables: { user: peerTitle },
          },
          tabId,
        });
      }

      if (inputInvoice?.type === 'stargiftAuctionBid') {
        const { activeGiftAuction } = selectTabState(global, tabId);
        const giftsPerRound = activeGiftAuction?.gift.giftsPerRound;

        actions.showNotification({
          icon: 'auction-filled',
          title: {
            key: inputInvoice.isUpdateBid ? 'GiftAuctionBidIncreasedTitle' : 'GiftAuctionBidPlacedTitle',
          },
          message: {
            key: 'GiftAuctionBidPlacedMessage',
            variables: { count: giftsPerRound },
          },
          tabId,
        });

        if (activeGiftAuction?.gift.id === inputInvoice.giftId) {
          actions.loadActiveGiftAuction({ giftId: inputInvoice.giftId, tabId });
        }
      }

      break;
    }

    case 'updateStarsBalance': {
      global = updateStarsBalance(global, update.balance);

      setGlobal(global);

      actions.loadStarStatus();
      break;
    }

    case 'updateStarGiftAuctionState': {
      const { giftId, state } = update;

      Object.keys(global.byTabId).forEach((tabIdStr) => {
        const tabId = Number(tabIdStr);
        global = updateActiveGiftAuctionState(global, giftId, state, tabId);
      });

      setGlobal(global);
      break;
    }

    case 'updateStarGiftAuctionUserState': {
      const { giftId, userState } = update;

      Object.keys(global.byTabId).forEach((tabIdStr) => {
        const tabId = Number(tabIdStr);
        global = updateActiveGiftAuctionUserState(global, giftId, userState, tabId);
      });

      setGlobal(global);
      break;
    }
  }
});
