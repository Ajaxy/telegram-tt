import type { ActionReturnType } from '../../types';

import { formatCurrencyAsString } from '../../../util/formatCurrency';
import * as langProvider from '../../../util/oldLangProvider';
import { addActionHandler, setGlobal } from '../../index';
import { updateStarsBalance } from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import { selectTabState } from '../../selectors';

addActionHandler('apiUpdate', (global, actions, update): ActionReturnType => {
  switch (update['@type']) {
    case 'updatePaymentStateCompleted': {
      const { paymentState, tabId } = update;
      const form = paymentState.form!;
      const { invoice } = form;

      const { totalAmount, currency } = invoice;

      if (paymentState.inputInvoice?.type === 'stars') {
        actions.closeStarsBalanceModal({ tabId });
        actions.showNotification({
          message: langProvider.oldTranslate('StarsAcquiredInfo', paymentState.inputInvoice.stars),
          title: langProvider.oldTranslate('StarsAcquired'),
          icon: 'star',
          tabId,
        });
        actions.requestConfetti({ withStars: true, tabId });
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
            message: langProvider.oldTranslate('StarsGiftCompleted'),
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
            message: langProvider.oldTranslate('StarsGiftCompleted'),
            tabId,
          });
          actions.requestConfetti({ withStars: true, tabId });
          actions.closeGiftModal({ tabId });
        }
      }

      break;
    }

    case 'updateStarsBalance': {
      const stars = global.stars;
      if (!stars) {
        return;
      }

      global = updateStarsBalance(global, update.balance);

      setGlobal(global);

      actions.loadStarStatus();
      break;
    }
  }
});
