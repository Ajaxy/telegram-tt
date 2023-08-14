import { addActionHandler } from '../../index';

import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { updateTabState } from '../../reducers/tabs';
import { selectTabState } from '../../selectors';

addActionHandler('openChat', (global, actions, payload): ActionReturnType => {
  const {
    id,
    tabId = getCurrentTabId(),
  } = payload;

  if (id) {
    return updateTabState(global, {
      reactionPicker: {
        chatId: id,
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
    storyUserId,
    storyId,
    position,
    tabId = getCurrentTabId(),
  } = payload!;

  return updateTabState(global, {
    reactionPicker: {
      storyUserId,
      storyId,
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
      storyUserId: undefined,
    },
  }, tabId);
});
