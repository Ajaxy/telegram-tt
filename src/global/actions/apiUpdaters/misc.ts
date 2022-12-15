import { addActionHandler, getGlobal, setGlobal } from '../../index';

import { PaymentStep } from '../../../types';

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

    case 'updateConfig':
      actions.loadConfig();
      break;

    case 'updateFavoriteStickers':
      actions.loadFavoriteStickers();
      break;

    case 'updateRecentStickers':
      actions.loadRecentStickers();
      break;

    case 'updateStickerSets':
      actions.loadStickerSets();
      break;

    case 'updateStickerSetsOrder':
      actions.reorderStickerSets({ order: update.order, isCustomEmoji: update.isCustomEmoji });
      break;

    case 'updateSavedGifs':
      actions.loadSavedGifs();
      break;

    case 'updatePrivacy':
      setGlobal({
        ...global,
        settings: {
          ...global.settings,
          privacy: {
            ...global.settings.privacy,
            [update.key]: update.rules,
          },
        },
      });
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
