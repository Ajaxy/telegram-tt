import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { addActionHandler } from '../../index';
import { updateTabState } from '../../reducers/tabs';
import { selectTabState } from '../../selectors';

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
  } = payload!;

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
  } = payload!;

  return updateTabState(global, {
    reactionPicker: {
      storyPeerId: peerId,
      storyId,
      sendAsMessage,
      position,
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
    },
  }, tabId);
});
