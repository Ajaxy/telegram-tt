import type {
  ApiPeerStories,
  ApiReaction,
  ApiStealthMode,
  ApiStory,
  ApiStoryDeleted,
  ApiStorySkipped,
  ApiStoryViews,
  ApiTypeStory,
  ApiTypeStoryView,
} from '../../api/types';
import type { GlobalState, TabArgs } from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import { compareFields, unique } from '../../util/iteratees';
import { getServerTime } from '../../util/serverTime';
import { isUserId, updateReactionCount } from '../helpers';
import {
  selectPeer, selectPeerStories, selectPeerStory, selectTabState, selectUser,
} from '../selectors';
import { updatePeer } from './general';
import { updateTabState } from './tabs';

export function addStories<T extends GlobalState>(global: T, newStoriesByPeerId: Record<string, ApiPeerStories>): T {
  const updatedByPeerId = Object.entries(newStoriesByPeerId).reduce((acc, [peerId, newPeerStories]) => {
    if (!acc[peerId]) {
      acc[peerId] = newPeerStories;
    } else {
      acc[peerId].byId = { ...acc[peerId].byId, ...newPeerStories.byId };
      acc[peerId].orderedIds = unique(newPeerStories.orderedIds.concat(acc[peerId].orderedIds));
      acc[peerId].pinnedIds = unique(newPeerStories.pinnedIds.concat(acc[peerId].pinnedIds)).sort((a, b) => b - a);
      acc[peerId].lastUpdatedAt = newPeerStories.lastUpdatedAt;
      acc[peerId].lastReadId = newPeerStories.lastReadId;
    }

    return acc;
  }, global.stories.byPeerId);

  global = {
    ...global,
    stories: {
      ...global.stories,
      byPeerId: updatedByPeerId,
    },
  };

  return updateOrderedStoriesPeerIds(global, Object.keys(newStoriesByPeerId));
}

export function addStoriesForPeer<T extends GlobalState>(
  global: T,
  peerId: string,
  newStories: Record<number, ApiTypeStory>,
  addToArchive?: boolean,
): T {
  const {
    byId, orderedIds, pinnedIds, archiveIds,
  } = global.stories.byPeerId[peerId] || {};
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

  if (addToArchive && peerId === global.currentUserId) {
    updatedArchiveIds = unique(updatedArchiveIds.concat(Object.keys(newStories).map(Number)))
      .sort((a, b) => b - a)
      .filter((storyId) => !deletedIds.includes(storyId));
  }

  global = {
    ...global,
    stories: {
      ...global.stories,
      byPeerId: {
        ...global.stories.byPeerId,
        [peerId]: {
          ...global.stories.byPeerId[peerId],
          byId: updatedById,
          orderedIds: updatedOrderedIds,
          pinnedIds: updatedPinnedIds,
          ...(addToArchive && { archiveIds: updatedArchiveIds }),
        },
      },
    },
  };

  if (peerId === global.currentUserId
    || selectUser(global, peerId)?.isContact
    || peerId === global.appConfig?.storyChangelogUserId) {
    global = updatePeerLastUpdatedAt(global, peerId);
    global = updateOrderedStoriesPeerIds(global, [peerId]);
  }

  return global;
}

export function updateStoriesForPeer<T extends GlobalState>(
  global: T,
  peerId: string,
  peerStories: ApiPeerStories,
): T {
  return {
    ...global,
    stories: {
      ...global.stories,
      byPeerId: {
        ...global.stories.byPeerId,
        [peerId]: peerStories,
      },
    },
  };
}

export function updateLastReadStoryForPeer<T extends GlobalState>(
  global: T,
  peerId: string,
  lastReadId: number,
): T {
  const { orderedIds } = selectPeerStories(global, peerId) || {};
  if (!orderedIds) {
    return global;
  }

  if (lastReadId >= orderedIds[orderedIds.length - 1]) {
    global = updatePeer(global, peerId, {
      hasUnreadStories: false,
    });
  }

  return {
    ...global,
    stories: {
      ...global.stories,
      byPeerId: {
        ...global.stories.byPeerId,
        [peerId]: {
          ...global.stories.byPeerId[peerId],
          lastReadId,
        },
      },
    },
  };
}

export function updateLastViewedStoryForPeer<T extends GlobalState>(
  global: T,
  peerId: string,
  lastViewedId: number,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const { orderedIds } = selectPeerStories(global, peerId) || {};
  if (!orderedIds || !orderedIds.includes(lastViewedId)) {
    return global;
  }

  const { storyViewer } = selectTabState(global, tabId);

  return updateTabState(global, {
    storyViewer: {
      ...storyViewer,
      lastViewedByPeerIds: {
        ...storyViewer.lastViewedByPeerIds,
        [peerId]: lastViewedId,
      },
    },
  }, tabId);
}

export function updatePeersWithStories<T extends GlobalState>(
  global: T,
  storiesByPeerId: Record<string, ApiPeerStories>,
): T {
  Object.entries(storiesByPeerId).forEach(([peerId, { lastReadId, orderedIds }]) => {
    const peer = selectPeer(global, peerId);
    if (!peer) return;

    global = updatePeer(global, peerId, {
      hasStories: true,
      hasUnreadStories: !lastReadId
        || Boolean(lastReadId && lastReadId < (peer.maxStoryId || orderedIds[orderedIds.length - 1])),
    });
  });

  return global;
}

export function updateStoryViews<T extends GlobalState>(
  global: T,
  storyId: number,
  views: ApiTypeStoryView[],
  nextOffset?: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const tabState = selectTabState(global, tabId);
  const { viewModal } = tabState.storyViewer;
  const newViews = viewModal?.storyId === storyId && viewModal.views ? [
    ...viewModal.views,
    ...views,
  ] : views;

  global = updateStoryViewsLoading(global, false, tabId);

  return updateTabState(global, {
    storyViewer: {
      ...tabState.storyViewer,
      viewModal: {
        ...viewModal,
        storyId,
        views: newViews,
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

export function removePeerStory<T extends GlobalState>(
  global: T,
  peerId: string,
  storyId: number,
): T {
  const {
    orderedIds, pinnedIds, lastReadId, byId,
  } = selectPeerStories(global, peerId) || { orderedIds: [] as number[], pinnedIds: [] as number[] };

  const newOrderedIds = orderedIds.filter((id) => id !== storyId);
  const newPinnedIds = pinnedIds.filter((id) => id !== storyId);
  const lastStoryId = newOrderedIds.length ? orderedIds[orderedIds.length - 1] : undefined;

  const previousStoryId = orderedIds[orderedIds.indexOf(storyId) - 1];
  const newLastReadId = lastReadId === storyId ? previousStoryId : lastReadId;

  const newById = {
    ...byId,
    [storyId]: { id: storyId, peerId, isDeleted: true } as ApiStoryDeleted,
  };
  const lastUpdatedAt = lastStoryId ? (newById[lastStoryId] as ApiStory | undefined)?.date : undefined;
  const hasStories = Boolean(newOrderedIds.length);

  global = updatePeer(global, peerId, {
    hasStories,
    hasUnreadStories: Boolean(hasStories && lastReadId && lastStoryId && lastReadId < lastStoryId),
  });

  global = updateStoriesForPeer(global, peerId, {
    byId: newById,
    orderedIds: newOrderedIds,
    pinnedIds: newPinnedIds,
    lastUpdatedAt,
    lastReadId: newLastReadId,
  });

  Object.values(global.byTabId).forEach((tab) => {
    if (tab.storyViewer.lastViewedByPeerIds?.[peerId] === storyId) {
      global = updateLastViewedStoryForPeer(global, peerId, previousStoryId, tab.id);
    }
  });

  if (!hasStories) {
    global = {
      ...global,
      stories: {
        ...global.stories,
        orderedPeerIds: {
          active: global.stories.orderedPeerIds.active.filter((id) => id !== peerId),
          archived: global.stories.orderedPeerIds.archived.filter((id) => id !== peerId),
        },
      },
    };
  }

  return global;
}

export function updateSentStoryReaction<T extends GlobalState>(
  global: T,
  peerId: string,
  storyId: number,
  reaction: ApiReaction | undefined,
): T {
  const story = selectPeerStory(global, peerId, storyId);
  if (!story || !('content' in story)) return global;

  const { views } = story;
  const reactionsCount = views?.reactionsCount || 0;
  const hasReaction = views?.reactions?.some((r) => r.chosenOrder !== undefined);
  const reactions = updateReactionCount(views?.reactions || [], [reaction].filter(Boolean));

  const countDiff = !reaction ? -1 : hasReaction ? 0 : 1;
  const newReactionsCount = reactionsCount + countDiff;

  global = updatePeerStory(global, peerId, storyId, {
    sentReaction: reaction,
    views: {
      ...views,
      reactionsCount: newReactionsCount,
      reactions,
    },
  });

  return global;
}

export function updatePeerStory<T extends GlobalState>(
  global: T,
  peerId: string,
  storyId: number,
  storyUpdate: Partial<ApiStory>,
): T {
  const peerStories = selectPeerStories(global, peerId) || {
    byId: {}, orderedIds: [], pinnedIds: [], archiveIds: [],
  };

  return {
    ...global,
    stories: {
      ...global.stories,
      byPeerId: {
        ...global.stories.byPeerId,
        [peerId]: {
          ...peerStories,
          byId: {
            ...peerStories.byId,
            [storyId]: {
              ...peerStories.byId[storyId],
              ...storyUpdate,
            },
          },
        },
      },
    },
  };
}

export function updatePeerStoryViews<T extends GlobalState>(
  global: T,
  peerId: string,
  storyId: number,
  viewsUpdate: Partial<ApiStoryViews>,
): T {
  const story = selectPeerStory(global, peerId, storyId);
  if (!story || !('content' in story)) return global;

  const { views } = story;

  return updatePeerStory(global, peerId, storyId, {
    views: {
      ...views,
      ...viewsUpdate,
    },
  });
}

export function updatePeerPinnedStory<T extends GlobalState>(
  global: T,
  peerId: string,
  storyId: number,
  isPinned?: boolean,
): T {
  const peerStories = selectPeerStories(global, peerId) || {
    byId: {}, orderedIds: [], pinnedIds: [], archiveIds: [],
  };

  const newPinnedIds = isPinned
    ? unique(peerStories.pinnedIds.concat(storyId)).sort((a, b) => b - a)
    : peerStories.pinnedIds.filter((id) => storyId !== id);

  return {
    ...global,
    stories: {
      ...global.stories,
      byPeerId: {
        ...global.stories.byPeerId,
        [peerId]: {
          ...peerStories,
          pinnedIds: newPinnedIds,
        },
      },
    },
  };
}

export function updatePeerStoriesHidden<T extends GlobalState>(global: T, peerId: string, areHidden: boolean) {
  const peer = selectPeer(global, peerId);
  if (!peer) return global;

  const currentState = peer.areStoriesHidden;
  if (currentState === areHidden) return global; // `updateOrderedStoriesPeerIds` is computationally expensive

  global = updatePeer(global, peerId, {
    areStoriesHidden: areHidden,
  });

  return updateOrderedStoriesPeerIds(global, [peerId]);
}

function updateOrderedStoriesPeerIds<T extends GlobalState>(global: T, updatePeerIds: string[]): T {
  const { currentUserId, stories: { byPeerId, orderedPeerIds } } = global;

  const allPeerIds = orderedPeerIds.active.concat(orderedPeerIds.archived).concat(updatePeerIds);
  const newOrderedPeerIds = allPeerIds.reduce<{ active: string[]; archived: string[] }>((acc, peerId) => {
    if (!byPeerId[peerId]?.orderedIds?.length) return acc;
    const peer = selectPeer(global, peerId);

    if (peer?.areStoriesHidden) {
      acc.archived.push(peerId);
    } else {
      acc.active.push(peerId);
    }

    return acc;
  }, { active: [], archived: [] });

  function compare(peerIdA: string, peerIdB: string) {
    const peerA = selectPeer(global, peerIdA)!;
    const peerB = selectPeer(global, peerIdB)!;

    const diffCurrentUser = compareFields(currentUserId === peerIdA, currentUserId === peerIdB);
    if (diffCurrentUser) return diffCurrentUser;

    const { lastUpdatedAt: luaA = 0, orderedIds: orderedA, lastReadId: lriA = 0 } = byPeerId[peerIdA] || {};
    const hasUnreadA = lriA < orderedA?.[orderedA.length - 1];
    const { lastUpdatedAt: luaB = 0, orderedIds: orderedB, lastReadId: lriB = 0 } = byPeerId[peerIdB] || {};
    const hasUnreadB = lriB < orderedB?.[orderedB.length - 1];

    const diffUnread = compareFields(hasUnreadA, hasUnreadB);
    if (diffUnread) return diffUnread;

    const diffPremium = compareFields('isPremium' in peerA, 'isPremium' in peerB);
    if (diffPremium) return diffPremium;

    const diffType = compareFields(isUserId(peerIdA), isUserId(peerIdB));
    if (diffType) return diffType;

    return compareFields(luaA, luaB);
  }

  newOrderedPeerIds.archived = unique(newOrderedPeerIds.archived)
    .filter((peerId) => byPeerId[peerId]?.orderedIds?.length)
    .sort(compare);
  newOrderedPeerIds.active = unique(newOrderedPeerIds.active)
    .filter((peerId) => byPeerId[peerId]?.orderedIds?.length)
    .sort(compare);

  return {
    ...global,
    stories: {
      ...global.stories,
      orderedPeerIds: newOrderedPeerIds,
    },
  };
}

function updatePeerLastUpdatedAt<T extends GlobalState>(global: T, peerId: string): T {
  const peerStories = global.stories.byPeerId[peerId];
  const lastUpdatedAt = peerStories.orderedIds.reduce<number | undefined>((acc, storyId) => {
    const { date } = peerStories.byId[storyId] as ApiStorySkipped || {};
    if (date && (!acc || acc < date)) {
      acc = date;
    }

    return acc;
  }, undefined);

  return {
    ...global,
    stories: {
      ...global.stories,
      byPeerId: {
        ...global.stories.byPeerId,
        [peerId]: {
          ...peerStories,
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
