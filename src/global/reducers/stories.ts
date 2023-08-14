import type { GlobalState, TabArgs } from '../types';
import type {
  ApiUserStories, ApiStory, ApiStorySkipped, ApiStoryDeleted, ApiTypeStory,
} from '../../api/types';
import { orderBy, unique } from '../../util/iteratees';
import { updateUser } from './users';
import { selectTabState, selectUser, selectUserStories } from '../selectors';
import { getCurrentTabId } from '../../util/establishMultitabRole';
import { updateTabState } from './tabs';
import { getServerTime } from '../../util/serverTime';

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

export function updateStorySeenBy<T extends GlobalState>(
  global: T,
  userId: string,
  storyId: number,
  seenByDates: Record<string, number>,
): T {
  const currentSeenBy = global.stories.seenByDates?.[userId]?.byId[storyId] || {};
  return {
    ...global,
    stories: {
      ...global.stories,
      seenByDates: {
        ...global.stories.seenByDates,
        [userId]: {
          ...global.stories.seenByDates?.[userId],
          byId: {
            ...global.stories.seenByDates?.[userId]?.byId,
            [storyId]: {
              ...currentSeenBy,
              ...seenByDates,
            },
          },
        },
      },
    },
  };
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

  global = updateUser(global, userId, {
    hasStories: newOrderedIds.length > 0,
    hasUnreadStories: Boolean(lastReadId && lastStoryId && lastReadId < lastStoryId),
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

  if (newOrderedIds.length === 0) {
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
  story: Partial<ApiStory>,
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
            [story.id!]: {
              ...userStories.byId[story.id!],
              ...story,
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
    if (selectUser(global, userId)?.areStoriesHidden) {
      acc.archived.push(userId);
    } else {
      acc.active.push(userId);
    }

    return acc;
  }, { active: [], archived: [] });

  function sort(userId: string) {
    return currentUserId === userId ? Infinity : byUserId[userId].lastUpdatedAt;
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
