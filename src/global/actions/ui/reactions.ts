import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { getMessageKey } from '../../../util/keys/messageKey';
import { addActionHandler } from '../../index';
import { updateChatMessage } from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import { selectChatMessage, selectTabState } from '../../selectors';

addActionHandler('processOpenChatOrThread', (global, actions, payload): ActionReturnType => {
  const {
    chatId,
    tabId = getCurrentTabId(),
  } = payload;

  if (chatId) {
    return updateTabState(global, {
      reactionPicker: {
        chatId,
        messageId: undefined,
        position: undefined,
      },
    }, tabId);
  }

  return updateTabState(global, {
    reactionPicker: undefined,
  }, tabId);
});

addActionHandler('openMessageReactionPicker', (global, actions, payload): ActionReturnType => {
  const {
    chatId,
    messageId,
    position,
    tabId = getCurrentTabId(),
  } = payload;

  return updateTabState(global, {
    reactionPicker: {
      chatId,
      messageId,
      position,
    },
  }, tabId);
});

addActionHandler('openStoryReactionPicker', (global, actions, payload): ActionReturnType => {
  const {
    peerId,
    storyId,
    position,
    sendAsMessage,
    tabId = getCurrentTabId(),
  } = payload;

  return updateTabState(global, {
    reactionPicker: {
      storyPeerId: peerId,
      storyId,
      sendAsMessage,
      position,
    },
  }, tabId);
});

addActionHandler('openEffectPicker', (global, actions, payload): ActionReturnType => {
  const {
    position,
    chatId,
    tabId = getCurrentTabId(),
  } = payload;

  return updateTabState(global, {
    reactionPicker: {
      position,
      chatId,
      isForEffects: true,
    },
  }, tabId);
});

addActionHandler('closeReactionPicker', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const tabState = selectTabState(global, tabId);

  return updateTabState(global, {
    reactionPicker: {
      ...tabState.reactionPicker,
      messageId: undefined,
      position: undefined,
      storyId: undefined,
      storyPeerId: undefined,
      isForEffects: undefined,
    },
  }, tabId);
});

addActionHandler('resetLocalPaidReactions', (global, actions, payload): ActionReturnType => {
  const { chatId, messageId } = payload;
  const message = selectChatMessage(global, chatId, messageId);
  if (!message) {
    return undefined;
  }

  const { reactions } = message;

  if (!reactions) {
    return undefined;
  }

  const updatedResults = reactions.results.map((reaction) => {
    if (reaction.localAmount) {
      if (!reaction.count) return undefined;
      return {
        ...reaction,
        localAmount: undefined,
        localPreviousChosenOrder: undefined,
        chosenOrder: reaction.localPreviousChosenOrder,
      };
    }
    return reaction;
  }).filter(Boolean);

  Object.values(global.byTabId)
    .forEach(({ id: tabId }) => {
      actions.dismissNotification({
        localId: getMessageKey(message),
        tabId,
      });
    });

  return updateChatMessage(global, chatId, messageId, {
    reactions: {
      ...reactions,
      results: updatedResults,
    },
  });
});
