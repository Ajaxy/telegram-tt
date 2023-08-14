import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { callApi } from '../../../api/gramjs';

import type { ActionReturnType } from '../../types';

import { updateTabState } from '../../reducers/tabs';
import {
  selectCurrentViewedStory,
  selectTabState,
  selectUser,
  selectUserFirstStoryId,
  selectUserFirstUnreadStoryId,
  selectUserStories,
} from '../../selectors';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { copyTextToClipboard } from '../../../util/clipboard';
import { fetchChatByUsername } from '../api/chats';
import { addStoriesForUser, addUsers } from '../../reducers';
import { buildCollectionByKey } from '../../../util/iteratees';
import * as langProvider from '../../../util/langProvider';

addActionHandler('openStoryViewer', async (global, actions, payload): Promise<void> => {
  const {
    userId, storyId, isSingleUser, isSingleStory, isPrivate, isArchive, tabId = getCurrentTabId(),
  } = payload;

  const user = selectUser(global, userId);
  if (!user) {
    return;
  }

  const tabState = selectTabState(global, tabId);
  const userStories = selectUserStories(global, userId);

  if (storyId && (!userStories || !userStories.byId[storyId])) {
    const result = await callApi('fetchUserStoriesByIds', { user, ids: [storyId] });

    if (!result) {
      return;
    }
    global = getGlobal();
    global = addUsers(global, buildCollectionByKey(result.users, 'id'));
    global = addStoriesForUser(global, userId, result.stories);
  }

  global = updateTabState(global, {
    storyViewer: {
      ...tabState.storyViewer,
      userId,
      storyId: storyId || selectUserFirstUnreadStoryId(global, userId) || selectUserFirstStoryId(global, userId),
      isSingleUser,
      isPrivate,
      isArchive,
      isSingleStory,
      storyIdSeenBy: undefined,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('openStoryViewerByUsername', async (global, actions, payload): Promise<void> => {
  const {
    username, storyId, tabId = getCurrentTabId(),
  } = payload;

  const chat = await fetchChatByUsername(global, username);

  if (!chat) {
    return;
  }

  actions.openStoryViewer({
    userId: chat.id,
    storyId,
    isSingleUser: true,
    isSingleStory: true,
    tabId,
  });
});

addActionHandler('closeStoryViewer', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const {
    isMuted, isRibbonShown, isArchivedRibbonShown, storyId,
  } = selectTabState(global, tabId).storyViewer;

  if (!storyId) return global;

  global = updateTabState(global, {
    storyViewer: {
      isMuted,
      isRibbonShown,
      isArchivedRibbonShown,
      lastViewedByUserIds: undefined,
    },
  }, tabId);

  // @optimization Reset `seenByDates` when all viewers are closed
  const hasViewerOpen = Object.keys(global.byTabId).find((id) => selectTabState(global, Number(id)).storyViewer.userId);
  if (!hasViewerOpen) {
    global = {
      ...global,
      stories: {
        ...global.stories,
        seenByDates: undefined,
      },
    };
  }

  return global;
});

addActionHandler('setStoryViewerMuted', (global, actions, payload): ActionReturnType => {
  const {
    isMuted,
    tabId = getCurrentTabId(),
  } = payload;

  return updateTabState(global, {
    storyViewer: {
      ...selectTabState(global, tabId).storyViewer,
      isMuted,
    },
  }, tabId);
});

addActionHandler('toggleStoryRibbon', (global, actions, payload): ActionReturnType => {
  const { isShown, isArchived, tabId = getCurrentTabId() } = payload;

  const orderedIds = global.stories.orderedUserIds[isArchived ? 'archived' : 'active'];
  if (!orderedIds?.length) {
    return global;
  }

  return updateTabState(global, {
    storyViewer: {
      ...selectTabState(global, tabId).storyViewer,
      [isArchived ? 'isArchivedRibbonShown' : 'isRibbonShown']: isShown,
    },
  }, tabId);
});

addActionHandler('openPreviousStory', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const tabState = selectTabState(global, tabId);
  const {
    userId, storyId, isSingleUser, isSingleStory, isPrivate, isArchive,
  } = tabState.storyViewer;

  if (isSingleStory) {
    actions.closeStoryViewer({ tabId });
    return undefined;
  }

  const { orderedUserIds: { active, archived } } = global.stories;
  if (!userId || !storyId) {
    return undefined;
  }

  const user = selectUser(global, userId);
  const userStories = selectUserStories(global, userId);
  if (!userStories || !user) {
    return undefined;
  }

  const orderedUserIds = (user.areStoriesHidden ? archived : active) ?? [];
  const storySourceProp = isArchive ? 'archiveIds' : isPrivate ? 'pinnedIds' : 'orderedIds';
  const userStoryIds = userStories[storySourceProp] ?? [];
  const currentStoryIndex = userStoryIds.indexOf(storyId);
  let previousStoryIndex: number;
  let previousUserId: string;

  if (currentStoryIndex > 0) {
    previousStoryIndex = currentStoryIndex - 1;
    previousUserId = userId;
  } else {
    const previousUserIdIndex = orderedUserIds.indexOf(userId) - 1;
    if (isSingleUser || previousUserIdIndex < 0) {
      return undefined;
    }

    previousUserId = orderedUserIds[previousUserIdIndex];
    previousStoryIndex = (selectUserStories(global, previousUserId)?.orderedIds.length || 1) - 1;
  }

  const previousStoryId = selectUserStories(global, previousUserId)?.[storySourceProp]?.[previousStoryIndex];
  if (!previousStoryId) {
    return undefined;
  }

  return updateTabState(global, {
    storyViewer: {
      ...tabState.storyViewer,
      userId: previousUserId,
      storyId: previousStoryId,
    },
  }, tabId);
});

addActionHandler('openNextStory', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const tabState = selectTabState(global, tabId);
  const {
    userId, storyId, isSingleUser, isSingleStory, isPrivate, isArchive,
  } = tabState.storyViewer;
  if (isSingleStory) {
    actions.closeStoryViewer({ tabId });
    return undefined;
  }

  const { orderedUserIds: { active, archived } } = global.stories;
  if (!userId || !storyId) {
    return undefined;
  }

  const user = selectUser(global, userId);
  const userStories = selectUserStories(global, userId);
  if (!userStories || !user) {
    return undefined;
  }

  const orderedUserIds = (user.areStoriesHidden ? archived : active) ?? [];
  const storySourceProp = isArchive ? 'archiveIds' : isPrivate ? 'pinnedIds' : 'orderedIds';
  const userStoryIds = userStories[storySourceProp] ?? [];
  const currentStoryIndex = userStoryIds.indexOf(storyId);
  let nextStoryIndex: number;
  let nextUserId: string;

  if (currentStoryIndex < userStoryIds.length - 1) {
    nextStoryIndex = currentStoryIndex + 1;
    nextUserId = userId;
  } else {
    const nextUserIdIndex = orderedUserIds.indexOf(userId) + 1;
    if (isSingleUser || nextUserIdIndex > orderedUserIds.length - 1) {
      actions.closeStoryViewer({ tabId });
      return undefined;
    }

    nextUserId = orderedUserIds[nextUserIdIndex];
    nextStoryIndex = 0;
  }

  const nextStoryId = selectUserStories(global, nextUserId)?.[storySourceProp]?.[nextStoryIndex];
  if (!nextStoryId) {
    return undefined;
  }

  return updateTabState(global, {
    storyViewer: {
      ...tabState.storyViewer,
      userId: nextUserId,
      storyId: nextStoryId,
    },
  }, tabId);
});

addActionHandler('openStorySeenBy', (global, actions, payload): ActionReturnType => {
  const { storyId, tabId = getCurrentTabId() } = payload;
  const tabState = selectTabState(global, tabId);

  return updateTabState(global, {
    storyViewer: {
      ...tabState.storyViewer,
      storyIdSeenBy: storyId,
    },
  }, tabId);
});

addActionHandler('closeStorySeenBy', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const tabState = selectTabState(global, tabId);

  return updateTabState(global, {
    storyViewer: {
      ...tabState.storyViewer,
      storyIdSeenBy: undefined,
    },
  }, tabId);
});

addActionHandler('copyStoryLink', async (global, actions, payload): Promise<void> => {
  const { userId, storyId, tabId = getCurrentTabId() } = payload;

  const link = await callApi('fetchStoryLink', { userId, storyId });
  if (!link) {
    return;
  }

  copyTextToClipboard(link);
  actions.showNotification({
    message: langProvider.translate('LinkCopied'),
    tabId,
  });
});

addActionHandler('sendMessage', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload;
  const { storyId, userId: storyUserId } = selectCurrentViewedStory(global, tabId);
  const isStoryReply = Boolean(storyId && storyUserId);

  if (!isStoryReply) {
    return;
  }

  const { gif, sticker, isReaction } = payload;

  let message: string;
  if (gif) {
    message = 'Story.Tooltip.GifSent';
  } else if (sticker) {
    message = 'Story.Tooltip.StickerSent';
  } else if (isReaction) {
    message = 'Story.Tooltip.ReactionSent';
  } else {
    message = 'Story.Tooltip.MessageSent';
  }

  actions.showNotification({
    message: langProvider.translate(message),
    actionText: langProvider.translate('Story.ToastViewInChat'),
    action: [{
      action: 'closeStoryViewer',
      payload: undefined,
    }, {
      action: 'openChat',
      payload: { id: storyUserId },
    }],
    tabId,
  });
});

addActionHandler('openStoryPrivacyEditor', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const tabState = selectTabState(global, tabId);

  return updateTabState(global, {
    storyViewer: {
      ...tabState.storyViewer,
      isPrivacyModalOpen: true,
    },
  }, tabId);
});

addActionHandler('closeStoryPrivacyEditor', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const tabState = selectTabState(global, tabId);

  return updateTabState(global, {
    storyViewer: {
      ...tabState.storyViewer,
      isPrivacyModalOpen: false,
    },
  }, tabId);
});
