import type {
  ApiStealthMode,
  ApiStory, ApiStoryDeleted, ApiStorySkipped, ApiStoryView, ApiTypeStory, ApiUserStories,
} from '../../api/types';
import type { GlobalState, TabArgs } from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import { orderBy, unique } from '../../util/iteratees';
import { getServerTime } from '../../util/serverTime';
import { selectTabState, selectUser, selectUserStories } from '../selectors';
import { updateTabState } from './tabs';
import { updateUser } from './users';

export function addStories<T extends GlobalState>(global: T, newStoriesByUserId: Record<string, ApiUserStories>): T {
  const updatedByUserId = Object.entries(newStoriesByUserId).reduce((acc, [userId, newUserStories]) => {
    if (!acc[userId]) {
      acc[userId] = newUserStories;
    } else {
      acc[userId].byId = { ...acc[userId].byId, ...newUserStories.byId };
      acc[userId].orderedIds = unique(newUserStories.orderedIds.concat(acc[userId].orderedIds));
      acc[userId].pinnedIds = unique(newUserStories.pinnedIds.concat(acc[userId].pinnedIds)).sort((a, b) => b - a);
      acc[userId].lastUpdatedAt = newUserStories.lastUpdatedAt;
      acc[userId].lastReadId = newUserStories.lastReadId;
    }

    return acc;
  }, global.stories.byUserId);

  global = {
    ...global,
    stories: {
      ...global.stories,
      byUserId: updatedByUserId,
    },
  };

  return updateOrderedStoriesUserIds(global, Object.keys(newStoriesByUserId));
}

export function addStoriesForUser<T extends GlobalState>(
  global: T,
  userId: string,
  newStories: Record<number, ApiTypeStory>,
  addToArchive?: boolean,
): T {
  const {
    byId, orderedIds, pinnedIds, archiveIds,
  } = global.stories.byUserId[userId] || {};
  const deletedIds = Object.keys(newStories).filter((id) => 'isDeleted' in newStories[Number(id)]).map(Number);
  const updatedById = { ...byId, ...newStories };
  let updatedOrderedIds = [...(orderedIds || [])];
  let updatedArchiveIds = [...(archiveIds || [])];
  const updatedPinnedIds = unique(
    [...(pinnedIds || [])].concat(Object.values(newStories).reduce((ids, story) => {
      if ('isPinned' in story && story.isPinned) {
        ids.push(story.id);
      }

      return ids;
    }, [] as number[])),
  ).sort((a, b) => b - a).filter((storyId) => !deletedIds.includes(storyId));

  updatedOrderedIds = unique(Object.entries(newStories).reduce((acc, [storyId, story]) => {
    if ('expireDate' in story && story.expireDate && story.expireDate > getServerTime()) {
      acc.push(Number(storyId));
    }

    return acc;
  }, updatedOrderedIds)).filter((storyId) => !deletedIds.includes(storyId));

  if (addToArchive && userId === global.currentUserId) {
    updatedArchiveIds = unique(updatedArchiveIds.concat(Object.keys(newStories).map(Number)))
      .sort((a, b) => b - a)
      .filter((storyId) => !deletedIds.includes(storyId));
  }

  global = {
    ...global,
    stories: {
      ...global.stories,
      byUserId: {
        ...global.stories.byUserId,
        [userId]: {
          ...global.stories.byUserId[userId],
          byId: updatedById,
          orderedIds: updatedOrderedIds,
          pinnedIds: updatedPinnedIds,
          ...(addToArchive && { archiveIds: updatedArchiveIds }),
        },
      },
    },
  };

  if (userId === global.currentUserId
    || selectUser(global, userId)?.isContact
    || userId === global.appConfig?.storyChangelogUserId) {
    global = updateUserLastUpdatedAt(global, userId);
    global = updateOrderedStoriesUserIds(global, [userId]);
  }

  return global;
}

export function updateStoriesForUser<T extends GlobalState>(
  global: T,
  userId: string,
  userStories: ApiUserStories,
): T {
  return {
    ...global,
    stories: {
      ...global.stories,
      byUserId: {
        ...global.stories.byUserId,
        [userId]: userStories,
      },
    },
  };
}

export function updateLastReadStoryForUser<T extends GlobalState>(
  global: T,
  userId: string,
  lastReadId: number,
): T {
  const { orderedIds } = selectUserStories(global, userId) || {};
  if (!orderedIds) {
    return global;
  }

  if (lastReadId >= orderedIds[orderedIds.length - 1]) {
    global = updateUser(global, userId, {
      hasUnreadStories: false,
    });
  }

  return {
    ...global,
    stories: {
      ...global.stories,
      byUserId: {
        ...global.stories.byUserId,
        [userId]: {
          ...global.stories.byUserId[userId],
          lastReadId,
        },
      },
    },
  };
}

export function updateLastViewedStoryForUser<T extends GlobalState>(
  global: T,
  userId: string,
  lastViewedId: number,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const { orderedIds } = selectUserStories(global, userId) || {};
  if (!orderedIds || !orderedIds.includes(lastViewedId)) {
    return global;
  }

  const { storyViewer } = selectTabState(global, tabId);

  return updateTabState(global, {
    storyViewer: {
      ...storyViewer,
      lastViewedByUserIds: {
        ...storyViewer.lastViewedByUserIds,
        [userId]: lastViewedId,
      },
    },
  }, tabId);
}

export function updateUsersWithStories<T extends GlobalState>(
  global: T,
  storiesByUserId: Record<string, ApiUserStories>,
): T {
  Object.entries(storiesByUserId).forEach(([userId, { lastReadId, orderedIds }]) => {
    const user = global.users.byId[userId];

    if (user) {
      global = updateUser(global, userId, {
        hasStories: true,
        hasUnreadStories: !lastReadId
          || Boolean(lastReadId && lastReadId < (user.maxStoryId || orderedIds[orderedIds.length - 1])),
      });
    }
  });

  return global;
}

export function updateStoryViews<T extends GlobalState>(
  global: T,
  storyId: number,
  viewsById: Record<string, ApiStoryView>,
  nextOffset?: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const tabState = selectTabState(global, tabId);
  const { viewModal } = tabState.storyViewer;
  const newViewsById = viewModal?.storyId === storyId ? {
    ...viewModal.viewsById,
    ...viewsById,
  } : viewsById;

  global = updateStoryViewsLoading(global, false, tabId);

  return updateTabState(global, {
    storyViewer: {
      ...tabState.storyViewer,
      viewModal: {
        ...viewModal,
        storyId,
        viewsById: newViewsById,
        nextOffset,
        isLoading: false,
      },
    },
  }, tabId);
}

export function updateStoryViewsLoading<T extends GlobalState>(
  global: T,
  isLoading: boolean,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const tabState = selectTabState(global, tabId);
  const { viewModal } = tabState.storyViewer;
  if (!viewModal) return global;

  return updateTabState(global, {
    storyViewer: {
      ...tabState.storyViewer,
      viewModal: {
        ...viewModal,
        isLoading,
      },
    },
  }, tabId);
}

export function removeUserStory<T extends GlobalState>(
  global: T,
  userId: string,
  storyId: number,
): T {
  const {
    orderedIds, pinnedIds, lastReadId, byId,
  } = selectUserStories(global, userId) || { orderedIds: [] as number[], pinnedIds: [] as number[] };

  const newOrderedIds = orderedIds.filter((id) => id !== storyId);
  const newPinnedIds = pinnedIds.filter((id) => id !== storyId);
  const lastStoryId = newOrderedIds.length ? orderedIds[orderedIds.length - 1] : undefined;

  const previousStoryId = orderedIds[orderedIds.indexOf(storyId) - 1];
  const newLastReadId = lastReadId === storyId ? previousStoryId : lastReadId;

  const newById = {
    ...byId,
    [storyId]: { id: storyId, userId, isDeleted: true } as ApiStoryDeleted,
  };
  const lastUpdatedAt = lastStoryId ? (newById[lastStoryId] as ApiStory | undefined)?.date : undefined;
  const hasStories = Boolean(newOrderedIds.length);

  global = updateUser(global, userId, {
    hasStories,
    hasUnreadStories: Boolean(hasStories && lastReadId && lastStoryId && lastReadId < lastStoryId),
  });
  global = updateStoriesForUser(global, userId, {
    byId: newById,
    orderedIds: newOrderedIds,
    pinnedIds: newPinnedIds,
    lastUpdatedAt,
    lastReadId: newLastReadId,
  });

  Object.values(global.byTabId).forEach((tab) => {
    if (tab.storyViewer.lastViewedByUserIds?.[userId] === storyId) {
      global = updateLastViewedStoryForUser(global, userId, previousStoryId, tab.id);
    }
  });

  if (!hasStories) {
    global = {
      ...global,
      stories: {
        ...global.stories,
        orderedUserIds: {
          active: global.stories.orderedUserIds.active.filter((id) => id !== userId),
          archived: global.stories.orderedUserIds.archived.filter((id) => id !== userId),
        },
      },
    };
  }

  return global;
}

export function updateUserStory<T extends GlobalState>(
  global: T,
  userId: string,
  storyId: number,
  storyUpdate: Partial<ApiStory>,
): T {
  const userStories = selectUserStories(global, userId) || {
    byId: {}, orderedIds: [], pinnedIds: [], archiveIds: [],
  };

  return {
    ...global,
    stories: {
      ...global.stories,
      byUserId: {
        ...global.stories.byUserId,
        [userId]: {
          ...userStories,
          byId: {
            ...userStories.byId,
            [storyId]: {
              ...userStories.byId[storyId],
              ...storyUpdate,
            },
          },
        },
      },
    },
  };
}

export function updateUserPinnedStory<T extends GlobalState>(
  global: T,
  userId: string,
  storyId: number,
  isPinned?: boolean,
): T {
  const userStories = selectUserStories(global, userId) || {
    byId: {}, orderedIds: [], pinnedIds: [], archiveIds: [],
  };

  const newPinnedIds = isPinned
    ? unique(userStories.pinnedIds.concat(storyId)).sort((a, b) => b - a)
    : userStories.pinnedIds.filter((id) => storyId !== id);

  return {
    ...global,
    stories: {
      ...global.stories,
      byUserId: {
        ...global.stories.byUserId,
        [userId]: {
          ...userStories,
          pinnedIds: newPinnedIds,
        },
      },
    },
  };
}

export function toggleUserStoriesHidden<T extends GlobalState>(global: T, userId: string, isHidden: boolean) {
  global = updateUser(global, userId, {
    areStoriesHidden: isHidden ? true : undefined,
  });

  return updateOrderedStoriesUserIds(global, [userId]);
}

function updateOrderedStoriesUserIds<T extends GlobalState>(global: T, updateUserIds: string[]): T {
  const { currentUserId, stories: { byUserId, orderedUserIds } } = global;

  const allUserIds = orderedUserIds.active.concat(orderedUserIds.archived).concat(updateUserIds);
  const newOrderedUserIds = allUserIds.reduce<{ active: string[]; archived: string[] }>((acc, userId) => {
    if (!byUserId[userId]?.orderedIds?.length) return acc;

    if (selectUser(global, userId)?.areStoriesHidden) {
      acc.archived.push(userId);
    } else {
      acc.active.push(userId);
    }

    return acc;
  }, { active: [], archived: [] });

  function sort(userId: string) {
    const UNREAD_PRIORITY = 1e12;
    const PREMIUM_PRIORITY = 1e6;
    const isPremium = selectUser(global, userId)?.isPremium;
    const { lastUpdatedAt = 0, orderedIds, lastReadId = 0 } = byUserId[userId] || {};
    const hasUnread = lastReadId < orderedIds?.[orderedIds.length - 1];

    const priority = (hasUnread ? UNREAD_PRIORITY : 0) + (isPremium ? PREMIUM_PRIORITY : 0);

    return currentUserId === userId ? Infinity : (lastUpdatedAt + priority);
  }

  newOrderedUserIds.archived = orderBy(
    unique(newOrderedUserIds.archived)
      .filter((userId) => byUserId[userId]?.orderedIds?.length),
    sort,
    'desc',
  );
  newOrderedUserIds.active = orderBy(
    unique(newOrderedUserIds.active)
      .filter((userId) => byUserId[userId]?.orderedIds?.length),
    sort,
    'desc',
  );

  return {
    ...global,
    stories: {
      ...global.stories,
      orderedUserIds: newOrderedUserIds,
    },
  };
}

function updateUserLastUpdatedAt<T extends GlobalState>(global: T, userId: string): T {
  const userStories = global.stories.byUserId[userId];
  const lastUpdatedAt = userStories.orderedIds.reduce<number | undefined>((acc, storyId) => {
    const { date } = userStories.byId[storyId] as ApiStorySkipped || {};
    if (date && (!acc || acc < date)) {
      acc = date;
    }

    return acc;
  }, undefined);

  return {
    ...global,
    stories: {
      ...global.stories,
      byUserId: {
        ...global.stories.byUserId,
        [userId]: {
          ...userStories,
          lastUpdatedAt,
        },
      },
    },
  };
}

export function updateStealthMode<T extends GlobalState>(
  global: T,
  stealthMode: ApiStealthMode,
): T {
  return {
    ...global,
    stories: {
      ...global.stories,
      stealthMode,
    },
  };
}
