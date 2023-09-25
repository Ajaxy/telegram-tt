import type { ActionReturnType } from '../../types';

import { DEBUG, PREVIEW_AVATAR_COUNT } from '../../../config';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { buildCollectionByKey } from '../../../util/iteratees';
import { translate } from '../../../util/langProvider';
import { getServerTime } from '../../../util/serverTime';
import { callApi } from '../../../api/gramjs';
import { buildApiInputPrivacyRules, getStoryKey } from '../../helpers';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  addStories,
  addStoriesForUser,
  addUsers,
  removeUserStory,
  toggleUserStoriesHidden,
  updateLastReadStoryForUser,
  updateLastViewedStoryForUser,
  updateStealthMode,
  updateStoryViews,
  updateStoryViewsLoading,
  updateUser,
  updateUserPinnedStory,
  updateUserStory,
  updateUsersWithStories,
} from '../../reducers';
import {
  selectUser, selectUserStories, selectUserStory,
} from '../../selectors';

const INFINITE_LOOP_MARKER = 100;

addActionHandler('loadAllStories', async (global): Promise<void> => {
  let i = 0;

  while (global.stories.hasNext) {
    if (i++ >= INFINITE_LOOP_MARKER) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error('`actions/loadAllStories`: Infinite loop detected');
      }

      return;
    }

    global = getGlobal();
    const { stateHash, hasNext } = global.stories;
    if (stateHash && !hasNext) {
      return;
    }

    const result = await callApi('fetchAllStories', {
      isFirstRequest: !stateHash,
      stateHash,
    });

    if (!result) {
      return;
    }

    global = getGlobal();
    global.stories.stateHash = result.state;

    if ('userStories' in result) {
      global = addUsers(global, buildCollectionByKey(result.users, 'id'));
      global = addStories(global, result.userStories);
      global = updateUsersWithStories(global, result.userStories);
      global = updateStealthMode(global, result.stealthMode);
      global.stories.hasNext = result.hasMore;
    }

    setGlobal(global);
  }
});

addActionHandler('loadAllHiddenStories', async (global): Promise<void> => {
  let i = 0;

  while (global.stories.hasNextInArchive) {
    if (i++ >= INFINITE_LOOP_MARKER) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error('`actions/loadAllHiddenStories`: Infinite loop detected');
      }

      return;
    }

    global = getGlobal();
    const { archiveStateHash, hasNextInArchive } = global.stories;
    if (archiveStateHash && !hasNextInArchive) {
      return;
    }

    const result = await callApi('fetchAllStories', {
      isFirstRequest: !archiveStateHash,
      stateHash: archiveStateHash,
      isHidden: true,
    });

    if (!result) {
      return;
    }

    global = getGlobal();
    global.stories.archiveStateHash = result.state;

    if ('userStories' in result) {
      global = addUsers(global, buildCollectionByKey(result.users, 'id'));
      global = addStories(global, result.userStories);
      global = updateUsersWithStories(global, result.userStories);
      global = updateStealthMode(global, result.stealthMode);
      global.stories.hasNextInArchive = result.hasMore;
    }

    setGlobal(global);
  }
});

addActionHandler('loadUserSkippedStories', async (global, actions, payload): Promise<void> => {
  const { userId } = payload;
  const user = selectUser(global, userId);
  const userStories = selectUserStories(global, userId);
  if (!user || !userStories) {
    return;
  }
  const skippedStoryIds = Object.values(userStories.byId).reduce((acc, story) => {
    if (!('content' in story)) {
      acc.push(story.id);
    }

    return acc;
  }, [] as number[]);

  if (skippedStoryIds.length === 0) {
    return;
  }

  const result = await callApi('fetchUserStoriesByIds', {
    user,
    ids: skippedStoryIds,
  });

  if (!result) {
    return;
  }

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = addStoriesForUser(global, userId, result.stories);
  setGlobal(global);
});

addActionHandler('viewStory', async (global, actions, payload): Promise<void> => {
  const { userId, storyId, tabId = getCurrentTabId() } = payload;
  const user = selectUser(global, userId);
  const story = selectUserStory(global, userId, storyId);
  if (!user || !story || !('content' in story)) {
    return;
  }

  global = updateLastViewedStoryForUser(global, userId, storyId, tabId);
  setGlobal(global);

  const serverTime = getServerTime();

  if (story.expireDate < serverTime && story.isPinned) {
    void callApi('viewStory', { user, storyId });
  }

  const isUnread = (global.stories.byUserId[userId].lastReadId || 0) < story.id;
  if (!isUnread) {
    return;
  }

  const result = await callApi('markStoryRead', {
    user,
    storyId,
  });

  if (!result) {
    return;
  }

  global = getGlobal();
  global = updateLastReadStoryForUser(global, userId, storyId);
  setGlobal(global);
});

addActionHandler('deleteStory', async (global, actions, payload): Promise<void> => {
  const { storyId } = payload;

  const result = await callApi('deleteStory', { storyId });

  if (!result) {
    return;
  }

  global = getGlobal();
  global = removeUserStory(global, global.currentUserId!, storyId);
  setGlobal(global);
});

addActionHandler('toggleStoryPinned', async (global, actions, payload): Promise<void> => {
  const { storyId, isPinned } = payload;

  const story = selectUserStory(global, global.currentUserId!, storyId);
  const currentIsPinned = story && 'content' in story ? story.isPinned : undefined;
  global = updateUserStory(global, global.currentUserId!, storyId, { isPinned });
  global = updateUserPinnedStory(global, global.currentUserId!, storyId, isPinned);
  setGlobal(global);

  const result = await callApi('toggleStoryPinned', { storyId, isPinned });
  if (!result) {
    global = getGlobal();
    global = updateUserStory(global, global.currentUserId!, storyId, { isPinned: currentIsPinned });
    global = updateUserPinnedStory(global, global.currentUserId!, storyId, currentIsPinned);
    setGlobal(global);
  }
});

addActionHandler('loadUserStories', async (global, actions, payload): Promise<void> => {
  const { userId } = payload;
  const user = selectUser(global, userId);
  if (!user) {
    return;
  }

  const result = await callApi('fetchUserStories', { user });
  if (!result) {
    return;
  }

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = addStoriesForUser(global, userId, result.stories);
  if (result.lastReadStoryId) {
    global = updateLastReadStoryForUser(global, userId, result.lastReadStoryId);
  }
  setGlobal(global);
});

addActionHandler('loadUserPinnedStories', async (global, actions, payload): Promise<void> => {
  const { userId, offsetId } = payload;
  const user = selectUser(global, userId);
  if (!user) {
    return;
  }

  const result = await callApi('fetchUserPinnedStories', { user, offsetId });
  if (!result) {
    return;
  }

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = addStoriesForUser(global, userId, result.stories);
  setGlobal(global);
});

addActionHandler('loadStoriesArchive', async (global, actions, payload): Promise<void> => {
  const { offsetId } = payload;
  const currentUserId = global.currentUserId!;

  const result = await callApi('fetchStoriesArchive', { currentUserId, offsetId });
  if (!result) {
    return;
  }

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = addStoriesForUser(global, currentUserId, result.stories, true);
  setGlobal(global);
});

addActionHandler('loadUserStoriesByIds', async (global, actions, payload): Promise<void> => {
  const { userId, storyIds } = payload;
  const user = selectUser(global, userId);
  if (!user) {
    return;
  }

  const result = await callApi('fetchUserStoriesByIds', { user, ids: storyIds });
  if (!result) {
    return;
  }

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = addStoriesForUser(global, userId, result.stories);
  setGlobal(global);
});

addActionHandler('loadStoryViews', async (global, actions, payload): Promise<void> => {
  const {
    storyId,
    tabId = getCurrentTabId(),
  } = payload;
  const isPreload = 'isPreload' in payload;
  const {
    offset, areReactionsFirst, areJustContacts, query, limit,
  } = isPreload ? {
    offset: undefined,
    areReactionsFirst: undefined,
    areJustContacts: undefined,
    query: undefined,
    limit: PREVIEW_AVATAR_COUNT,
  } : payload;

  if (!isPreload) {
    global = updateStoryViewsLoading(global, true, tabId);
    setGlobal(global);
  }

  const result = await callApi('fetchStoryViewList', {
    storyId,
    offset,
    areReactionsFirst,
    areJustContacts,
    limit,
    query,
  });
  if (!result) {
    global = getGlobal();
    global = updateStoryViewsLoading(global, false, tabId);
    setGlobal(global);
    return;
  }

  const viewsById = buildCollectionByKey(result.views, 'userId');

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  if (!isPreload) global = updateStoryViews(global, storyId, viewsById, result.nextOffset, tabId);

  if (isPreload && result.views?.length) {
    const recentViewerIds = result.views.map((view) => view.userId);
    global = updateUserStory(global, global.currentUserId!, storyId, {
      recentViewerIds,
      viewsCount: result.viewsCount,
      reactionsCount: result.reactionsCount,
    });
  }
  setGlobal(global);
});

addActionHandler('reportStory', async (global, actions, payload): Promise<void> => {
  const {
    userId,
    storyId,
    reason,
    description,
    tabId = getCurrentTabId(),
  } = payload;
  const user = selectUser(global, userId);
  if (!user) {
    return;
  }

  const result = await callApi('reportStory', {
    user,
    storyId,
    reason,
    description,
  });

  actions.showNotification({
    message: result
      ? translate('ReportPeer.AlertSuccess')
      : 'An error occurred while submitting your report. Please, try again later.',
    tabId,
  });
});

addActionHandler('editStoryPrivacy', (global, actions, payload): ActionReturnType => {
  const {
    storyId,
    privacy,
  } = payload;

  const allowedIds = [...privacy.allowUserIds, ...privacy.allowChatIds];
  const blockedIds = [...privacy.blockUserIds, ...privacy.blockChatIds];

  const inputPrivacy = buildApiInputPrivacyRules(global, {
    visibility: privacy.visibility,
    isUnspecified: privacy.isUnspecified,
    allowedIds,
    blockedIds,
  });

  void callApi('editStoryPrivacy', {
    id: storyId,
    privacy: inputPrivacy,
  });
});

addActionHandler('toggleStoriesHidden', async (global, actions, payload): Promise<void> => {
  const { userId, isHidden } = payload;
  const user = selectUser(global, userId);
  if (!user) return;

  const result = await callApi('toggleStoriesHidden', { user, isHidden });
  if (!result) return;

  global = getGlobal();
  global = toggleUserStoriesHidden(global, userId, isHidden);
  setGlobal(global);
});

addActionHandler('loadStoriesMaxIds', async (global, actions, payload): Promise<void> => {
  const { userIds } = payload;
  const users = userIds.map((userId) => selectUser(global, userId)).filter(Boolean);
  if (!users.length) return;

  const result = await callApi('fetchStoriesMaxIds', { users });
  if (!result) return;

  const userIdsToLoad: string[] = [];

  global = getGlobal();
  result.forEach((maxId, i) => {
    const user = users[i];
    global = updateUser(global, user.id, {
      maxStoryId: maxId,
      hasStories: maxId !== 0,
    });
    if (maxId !== 0) {
      userIdsToLoad.push(user.id);
    }
  });
  setGlobal(global);

  userIdsToLoad?.forEach((userId) => actions.loadUserStories({ userId }));
});

addActionHandler('sendStoryReaction', async (global, actions, payload): Promise<void> => {
  const {
    userId, storyId, reaction, shouldAddToRecent, tabId = getCurrentTabId(),
  } = payload;
  const user = selectUser(global, userId);
  if (!user) return;

  const story = selectUserStory(global, userId, storyId);
  if (!story || !('content' in story)) return;

  const previousReaction = story.sentReaction;
  global = updateUserStory(global, userId, storyId, {
    sentReaction: reaction,
  });
  setGlobal(global);

  const containerId = getStoryKey(userId, storyId);
  if (reaction) {
    actions.startActiveReaction({ containerId, reaction, tabId });
  } else {
    actions.stopActiveReaction({ containerId, tabId });
  }

  const result = await callApi('sendStoryReaction', {
    user, storyId, reaction, shouldAddToRecent,
  });

  global = getGlobal();
  if (!result) {
    global = updateUserStory(global, userId, storyId, {
      sentReaction: previousReaction,
    });
  }
  setGlobal(global);
});

addActionHandler('activateStealthMode', (global, actions, payload): ActionReturnType => {
  const { isForPast = true, isForFuture = true } = payload || {};

  callApi('activateStealthMode', { isForPast: isForPast || true, isForFuture: isForFuture || true });
});
