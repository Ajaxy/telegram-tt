import type { ActionReturnType } from '../../types';
import { PaymentStep } from '../../../types';

import { SERVICE_NOTIFICATIONS_USER_ID } from '../../../config';
import { applyLangPackDifference, getTranslationFn, requestLangPackDifference } from '../../../util/localization';
import { getPeerTitle } from '../../helpers/peers';
import { addActionHandler, setGlobal } from '../../index';
import {
  addBlockedUser,
  addChats,
  addStoriesForPeer,
  addUsers,
  removeBlockedUser,
  removePeerStory,
  replaceWebPage,
  setConfirmPaymentUrl,
  setPaymentStep,
  updateFullWebPage,
  updateLastReadStoryForPeer,
  updatePeerStory,
  updatePeersWithStories,
  updatePoll,
  updateStealthMode,
  updateThreadInfos,
} from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import {
  selectPeer,
  selectPeerStories,
  selectPeerStory,
  selectTabState,
} from '../../selectors';

addActionHandler('apiUpdate', (global, actions, update): ActionReturnType => {
  switch (update['@type']) {
    case 'updateEntities': {
      const {
        users, chats, threadInfos, polls, webPages,
      } = update;
      if (users) global = addUsers(global, users);
      if (chats) global = addChats(global, chats);
      if (threadInfos) global = updateThreadInfos(global, threadInfos);
      if (polls) {
        polls.forEach((poll) => {
          global = updatePoll(global, poll.id, poll);
        });
      }
      if (webPages) {
        webPages.forEach((webPage) => {
          if (webPage.webpageType === 'full') {
            global = updateFullWebPage(global, webPage.id, webPage);
          } else {
            global = replaceWebPage(global, webPage.id, webPage);
          }
        });
      }
      setGlobal(global);
      break;
    }

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

    case 'updateSavedReactionTags':
      actions.loadSavedReactionTags();
      break;

    case 'updateMoveStickerSetToTop': {
      const oldOrder = update.isCustomEmoji ? global.customEmojis.added.setIds : global.stickers.added.setIds;
      if (!oldOrder?.some((id) => id === update.id)) return global;
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
        Object.entries(tabState.webApps.openedWebApps).forEach(([webAppKey, webApp]) => {
          if (webApp.queryId === update.queryId) {
            actions.resetDraftReplyInfo({ tabId: tabState.id });
            actions.closeWebApp({ key: webAppKey, tabId: tabState.id });
          }
        });
      });
      break;

    case 'updateWebPage': {
      const { webPage } = update;
      if (webPage.webpageType === 'full') {
        global = updateFullWebPage(global, webPage.id, webPage);
      } else {
        global = replaceWebPage(global, webPage.id, webPage);
      }
      setGlobal(global);
      break;
    }

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
      actions.loadAttachBots();
      break;

    case 'updatePremiumFloodWait': {
      actions.processPremiumFloodWait({
        isUpload: update.isUpload,
      });
      break;
    }

    case 'updatePaidReactionPrivacy': {
      global = {
        ...global,
        settings: {
          ...global.settings,
          paidReactionPrivacy: update.private,
        },
      };
      setGlobal(global);
      break;
    }

    case 'updateLangPackTooLong': {
      requestLangPackDifference(update.langCode);
      break;
    }

    case 'updateLangPack': {
      applyLangPackDifference(update.version, update.strings, update.keysToRemove);
      break;
    }

    case 'newMessage': {
      const action = update.message.content?.action;

      if (action?.type === 'starGift' && update.message.isOutgoing) {
        const { gift } = action;
        if (!gift.isAuction || update.message.chatId === SERVICE_NOTIFICATIONS_USER_ID) return undefined;

        const { chatId, id } = update.message;

        if (!chatId || !id) return;

        Object.values(global.byTabId).forEach(({ id: tabId }) => {
          actions.focusMessage({
            chatId,
            messageId: id,
            tabId,
          });
          actions.closeGiftAuctionBidModal({ tabId });
          actions.closeGiftModal({ tabId });

          actions.showNotification({
            icon: 'auction-filled',
            message: {
              key: 'GiftAuctionWonNotification',
              variables: {
                gift: gift.title,
              },
            },
            tabId,
          });

          actions.requestConfetti({ withStars: true, tabId });
        });
        return undefined;
      }

      if (!update.message.isOutgoing && update.message.chatId !== SERVICE_NOTIFICATIONS_USER_ID) return undefined;
      if (action?.type !== 'starGiftUnique') return undefined;
      const actionStarGift = action.gift;

      Object.values(global.byTabId).forEach(({ id: tabId }) => {
        const tabState = selectTabState(global, tabId);
        if (tabState.isWaitingForStarGiftUpgrade) {
          actions.openUniqueGiftBySlug({
            slug: actionStarGift.slug,
            tabId,
          });

          actions.showNotification({
            title: { key: 'GiftUpgradedTitle' },
            message: { key: 'GiftUpgradedDescription' },
            tabId,
          });

          actions.requestConfetti({ withStars: true, tabId });

          global = updateTabState(global, {
            isWaitingForStarGiftUpgrade: undefined,
          }, tabId);
        }

        if (tabState.isWaitingForStarGiftTransfer) {
          const chatId = update.message.chatId;
          const receiver = chatId ? selectPeer(global, chatId) : undefined;
          if (receiver) {
            actions.focusMessage({
              chatId: receiver.id,
              messageId: update.message.id!,
              tabId,
            });

            actions.showNotification({
              message: {
                key: 'GiftTransferSuccessMessage',
                variables: {
                  gift: {
                    key: 'GiftUnique',
                    variables: {
                      title: actionStarGift.title,
                      number: actionStarGift.number,
                    },
                  },
                  peer: getPeerTitle(getTranslationFn(), receiver),
                },
              },
              tabId,
            });
          }

          actions.requestConfetti({ withStars: true, tabId });

          global = updateTabState(global, {
            isWaitingForStarGiftTransfer: undefined,
          }, tabId);

          actions.reloadPeerSavedGifts({ peerId: global.currentUserId! });
        }
      });

      setGlobal(global);
    }
  }

  return undefined;
});
