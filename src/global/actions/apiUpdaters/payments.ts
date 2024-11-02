import type { ActionReturnType } from '../../types';

import { areDeepEqual } from '../../../util/areDeepEqual';
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

      actions.showNotification({
        tabId,
        message: langProvider.oldTranslate('PaymentInfoHint', [
          formatCurrencyAsString(totalAmount, currency, langProvider.getTranslationFn().code),
          form.title,
        ]),
      });

      setGlobal(global);

      break;
    }

    case 'updateStarPaymentStateCompleted': {
      const { paymentState, tabId } = update;
      const { inputInvoice, subscriptionInfo } = paymentState;
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

      if (inputInvoice?.type === 'giftcode') {
        if (!inputInvoice.userIds) {
          return;
        }
        const giftModalState = selectTabState(global, tabId).giftModal;

        if (giftModalState && inputInvoice.userIds[0] === giftModalState.forUserId) {
          global = updateTabState(global, {
            giftModal: {
              ...giftModalState,
              isCompleted: true,
            },
          }, tabId);
        }
      }

      if (inputInvoice?.type === 'starsgift') {
        if (!inputInvoice.userId) {
          return;
        }
        const starsModalState = selectTabState(global, tabId).starsGiftModal;

        if (starsModalState && starsModalState.isOpen
          && areDeepEqual(inputInvoice.userId, starsModalState.forUserId)) {
          global = updateTabState(global, {
            starsGiftModal: {
              ...starsModalState,
              isCompleted: true,
            },
          }, tabId);
        }
      }

      if (inputInvoice?.type === 'stars') {
        const starsModalState = selectTabState(global, tabId).starsGiftModal;

        if (starsModalState && starsModalState.isOpen) {
          global = updateTabState(global, {
            starsGiftModal: {
              ...starsModalState,
              isCompleted: true,
            },
          }, tabId);
        }
      }

      if (inputInvoice?.type === 'stars' || inputInvoice?.type === 'stargift') {
        actions.requestConfetti({ withStars: true, tabId });
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
