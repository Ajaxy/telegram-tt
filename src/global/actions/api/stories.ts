import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { callApi } from '../../../api/gramjs';

import { DEBUG, PREVIEW_AVATAR_COUNT } from '../../../config';
import {
  addStories,
  addStoriesForUser,
  addUsers,
  removeUserStory,
  toggleUserStoriesHidden,
  updateLastReadStoryForUser,
  updateLastViewedStoryForUser,
  updateStorySeenBy,
  updateUser,
  updateUserPinnedStory,
  updateUserStory,
  updateUsersWithStories,
} from '../../reducers';
import { buildCollectionByKey } from '../../../util/iteratees';
import { selectUser, selectUserStories, selectUserStory } from '../../selectors';
import { getServerTime } from '../../../util/serverTime';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { translate } from '../../../util/langProvider';
import type { ActionReturnType } from '../../types';

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
  global = updateUserStory(global, global.currentUserId!, { id: storyId, isPinned });
  global = updateUserPinnedStory(global, global.currentUserId!, storyId, isPinned);
  setGlobal(global);

  const result = await callApi('toggleStoryPinned', { storyId, isPinned });
  if (!result) {
    global = getGlobal();
    global = updateUserStory(global, global.currentUserId!, { id: storyId, isPinned: currentIsPinned });
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

addActionHandler('loadStorySeenBy', async (global, actions, payload): Promise<void> => {
  const { storyId, offsetId } = payload;

  const result = await callApi('fetchStorySeenBy', { storyId, offsetId });
  if (!result) {
    return;
  }

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = updateStorySeenBy(global, global.currentUserId!, storyId, result.seenByDates);

  const viewerIds = Object.keys(result.seenByDates);
  if (!offsetId && viewerIds.length) {
    const recentViewerIds = viewerIds.slice(-PREVIEW_AVATAR_COUNT).reverse();
    global = updateUserStory(global, global.currentUserId!, {
      id: storyId,
      recentViewerIds,
      viewsCount: result.count,
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

  const allowedUserList = privacy.allowUserIds?.map((userId) => selectUser(global, userId)).filter(Boolean);
  const deniedUserList = privacy.blockUserIds?.map((userId) => selectUser(global, userId)).filter(Boolean);
  void callApi('editStoryPrivacy', {
    id: storyId,
    visibility: privacy.visibility,
    allowedUserList,
    deniedUserList,
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
