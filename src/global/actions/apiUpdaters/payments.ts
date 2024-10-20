import type { ActionReturnType } from '../../types';

import { STARS_CURRENCY_CODE } from '../../../config';
import { areDeepEqual } from '../../../util/areDeepEqual';
import { formatCurrencyAsString } from '../../../util/formatCurrency';
import * as langProvider from '../../../util/oldLangProvider';
import { addActionHandler, setGlobal } from '../../index';
import { closeInvoice, updateStarsBalance } from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import { selectTabState } from '../../selectors';

addActionHandler('apiUpdate', (global, actions, update): ActionReturnType => {
  switch (update['@type']) {
    case 'updatePaymentStateCompleted': {
      Object.values(global.byTabId).forEach(({ id: tabId }) => {
        const { inputInvoice, invoice } = selectTabState(global, tabId).payment;

        if (!areDeepEqual(inputInvoice, update.inputInvoice)) return;

        if (invoice) {
          const { amount, currency, title } = invoice;

          if (currency !== STARS_CURRENCY_CODE) {
            actions.showNotification({
              tabId,
              message: langProvider.oldTranslate('PaymentInfoHint', [
                formatCurrencyAsString(amount, currency, langProvider.getTranslationFn().code),
                title,
              ]),
            });
          }
        }

        if (inputInvoice?.type === 'giftcode') {
          if (!inputInvoice.userIds) {
            return;
          }
          const giftModalState = selectTabState(global, tabId).giftModal;

          if (giftModalState && giftModalState.isOpen
            && areDeepEqual(inputInvoice.userIds, giftModalState.forUserIds)) {
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

          actions.loadStarStatus(); // Manually reload. Server update takes ~10 seconds
        }

        if (inputInvoice?.type === 'chatInviteSubscription') {
          const { amount } = invoice!;
          actions.showNotification({
            tabId,
            title: langProvider.oldTranslate('StarsSubscriptionCompleted'),
            message: langProvider.oldTranslate('StarsSubscriptionCompletedText', [
              amount,
              inputInvoice.inviteInfo.title,
            ], undefined, amount),
            icon: 'star',
          });
        }

        if (invoice?.currency === STARS_CURRENCY_CODE) {
          global = closeInvoice(global, tabId);
        }
        setGlobal(global);
      });

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
