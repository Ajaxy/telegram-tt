import { addActionHandler, setGlobal } from '../../index';

import type { ActionReturnType } from '../../types';
import { PaymentStep } from '../../../types';

import {
  addBlockedContact, removeBlockedContact, setConfirmPaymentUrl, setPaymentStep,
} from '../../reducers';

addActionHandler('apiUpdate', (global, actions, update): ActionReturnType => {
  switch (update['@type']) {
    case 'updatePeerBlocked':
      if (update.isBlocked) {
        return addBlockedContact(global, update.id);
      } else {
        return removeBlockedContact(global, update.id);
      }

    case 'updateResetContactList':
      global = {
        ...global,
        contactList: {
          userIds: [],
        },
      };
      setGlobal(global);
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

    case 'updateRecentEmojiStatuses':
      actions.loadRecentEmojiStatuses();
      break;

    case 'updateMoveStickerSetToTop': {
      const oldOrder = update.isCustomEmoji ? global.customEmojis.added.setIds : global.stickers.added.setIds;
      if (!oldOrder) return global;
      const newOrder = [update.id, ...oldOrder.filter((id) => id !== update.id)];
      actions.reorderStickerSets({ order: newOrder, isCustomEmoji: update.isCustomEmoji });
      break;
    }

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
      global = {
        ...global,
        settings: {
          ...global.settings,
          privacy: {
            ...global.settings.privacy,
            [update.key]: update.rules,
          },
        },
      };
      setGlobal(global);
      break;

    case 'updatePaymentVerificationNeeded':
      Object.values(global.byTabId).forEach(({ id: tabId }) => {
        global = setConfirmPaymentUrl(global, update.url, tabId);
        global = setPaymentStep(global, PaymentStep.ConfirmPayment, tabId);
      });
      setGlobal(global);
      break;

    case 'updateWebViewResultSent':
      Object.values(global.byTabId).forEach((tabState) => {
        if (tabState.webApp?.queryId === update.queryId) {
          actions.setReplyingToId({ messageId: undefined, tabId: tabState.id });
          actions.closeWebApp({ tabId: tabState.id });
        }
      });
      break;
  }

  return undefined;
});
