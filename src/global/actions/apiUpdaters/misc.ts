import { addActionHandler, getGlobal, setGlobal } from '../../index';

import { ApiPrivacyKey, PaymentStep } from '../../../types';

import {
  addBlockedContact, removeBlockedContact, setConfirmPaymentUrl, setPaymentStep,
} from '../../reducers';

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update['@type']) {
    case 'updatePeerBlocked':
      if (update.isBlocked) {
        return addBlockedContact(getGlobal(), update.id);
      } else {
        return removeBlockedContact(getGlobal(), update.id);
      }

    case 'updateResetContactList':
      setGlobal({
        ...getGlobal(),
        contactList: {
          userIds: [],
        },
      });
      break;

    case 'updateFavoriteStickers':
      actions.loadFavoriteStickers();
      break;

    case 'updatePrivacy':
      global.settings.privacy[update.key as ApiPrivacyKey] = update.rules;
      break;

    case 'updatePaymentVerificationNeeded':
      global = setConfirmPaymentUrl(getGlobal(), update.url);
      global = setPaymentStep(global, PaymentStep.ConfirmPayment);
      setGlobal(global);
      break;

    case 'updateWebViewResultSent':
      if (global.webApp?.queryId === update.queryId) {
        actions.setReplyingToId({ messageId: undefined });
        actions.closeWebApp();
      }
      break;
  }

  return undefined;
});
