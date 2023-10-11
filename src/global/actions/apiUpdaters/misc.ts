import type { ActionReturnType } from '../../types';
import { PaymentStep } from '../../../types';

import { addActionHandler, setGlobal } from '../../index';
import {
  addBlockedUser,
  addStoriesForPeer,
  removeBlockedUser,
  removePeerStory,
  setConfirmPaymentUrl,
  setPaymentStep,
  updateLastReadStoryForPeer,
  updatePeerStory,
  updatePeersWithStories,
  updateStealthMode,
} from '../../reducers';
import { selectPeerStories, selectPeerStory } from '../../selectors';

addActionHandler('apiUpdate', (global, actions, update): ActionReturnType => {
  switch (update['@type']) {
    case 'updatePeerBlocked':
      if (update.isBlocked) {
        return addBlockedUser(global, update.id);
      } else if (update.isBlockedFromStories) {
        return global; // Unsupported
      } else {
        return removeBlockedUser(global, update.id);
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

    case 'updateNewAuthorization': {
      // Load more info about this session
      actions.loadAuthorizations();
      break;
    }

    case 'updateFavoriteStickers':
      actions.loadFavoriteStickers();
      break;

    case 'updateRecentStickers':
      actions.loadRecentStickers();
      break;

    case 'updateRecentReactions':
      actions.loadRecentReactions();
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

    case 'updateStickerSetsOrder': {
      // Filter out invalid set IDs, which may be sent by the server
      const order = update.order.filter((setId) => Boolean(global.stickers.setsById[setId]));

      actions.reorderStickerSets({ order, isCustomEmoji: update.isCustomEmoji });
      break;
    }

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

    case 'updateStory':
      global = addStoriesForPeer(global, update.peerId, { [update.story.id]: update.story });
      global = updatePeersWithStories(global, { [update.peerId]: selectPeerStories(global, update.peerId)! });
      setGlobal(global);
      break;

    case 'deleteStory':
      global = removePeerStory(global, update.peerId, update.storyId);
      setGlobal(global);
      break;

    case 'updateReadStories':
      global = updateLastReadStoryForPeer(global, update.peerId, update.lastReadId);
      setGlobal(global);
      break;

    case 'updateSentStoryReaction': {
      const { peerId, storyId, reaction } = update;
      const story = selectPeerStory(global, peerId, storyId);
      if (!story) return global;
      global = updatePeerStory(global, peerId, storyId, { sentReaction: reaction });
      setGlobal(global);
      break;
    }

    case 'updateStealthMode':
      global = updateStealthMode(global, update.stealthMode);
      setGlobal(global);
      break;

    case 'updateAttachMenuBots':
      actions.loadAttachBots({ hash: global.attachMenu.hash });
      break;
  }

  return undefined;
});
