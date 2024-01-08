import type { ApiStoryView } from '../../../api/types';
import type { ActionReturnType } from '../../types';

import { DEBUG, PREVIEW_AVATAR_COUNT } from '../../../config';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { buildCollectionByKey } from '../../../util/iteratees';
import { translate } from '../../../util/langProvider';
import { getServerTime } from '../../../util/serverTime';
import { callApi } from '../../../api/gramjs';
import { buildApiInputPrivacyRules } from '../../helpers';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  addChats,
  addStories,
  addStoriesForPeer,
  addUsers,
  removePeerStory,
  updateLastReadStoryForPeer,
  updateLastViewedStoryForPeer,
  updatePeer,
  updatePeerPinnedStory,
  updatePeerStoriesHidden,
  updatePeerStory,
  updatePeerStoryViews,
  updatePeersWithStories,
  updateSentStoryReaction,
  updateStealthMode,
  updateStoryViews,
  updateStoryViewsLoading,
} from '../../reducers';
import {
  selectPeer, selectPeerStories, selectPeerStory,
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

    if ('peerStories' in result) {
      global = addUsers(global, buildCollectionByKey(result.users, 'id'));
      global = addChats(global, buildCollectionByKey(result.chats, 'id'));
      global = addStories(global, result.peerStories);
      global = updatePeersWithStories(global, result.peerStories);
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

    if ('peerStories' in result) {
      global = addUsers(global, buildCollectionByKey(result.users, 'id'));
      global = addChats(global, buildCollectionByKey(result.chats, 'id'));
      global = addStories(global, result.peerStories);
      global = updatePeersWithStories(global, result.peerStories);
      global = updateStealthMode(global, result.stealthMode);
      global.stories.hasNextInArchive = result.hasMore;
    }

    setGlobal(global);
  }
});

addActionHandler('loadPeerSkippedStories', async (global, actions, payload): Promise<void> => {
  const { peerId } = payload;
  const peer = selectPeer(global, peerId);
  const peerStories = selectPeerStories(global, peerId);
  if (!peer || !peerStories) {
    return;
  }
  const skippedStoryIds = Object.values(peerStories.byId).reduce((acc, story) => {
    if (!('content' in story)) {
      acc.push(story.id);
    }

    return acc;
  }, [] as number[]);

  if (skippedStoryIds.length === 0) {
    return;
  }

  const result = await callApi('fetchPeerStoriesByIds', {
    peer,
    ids: skippedStoryIds,
  });

  if (!result) {
    return;
  }

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = addChats(global, buildCollectionByKey(result.chats, 'id'));
  global = addStoriesForPeer(global, peerId, result.stories);
  setGlobal(global);
});

addActionHandler('viewStory', async (global, actions, payload): Promise<void> => {
  const { peerId, storyId, tabId = getCurrentTabId() } = payload;
  const peer = selectPeer(global, peerId);
  const story = selectPeerStory(global, peerId, storyId);
  if (!peer || !story || !('content' in story)) {
    return;
  }

  global = updateLastViewedStoryForPeer(global, peerId, storyId, tabId);
  setGlobal(global);

  const serverTime = getServerTime();

  if (story.expireDate < serverTime && story.isPinned) {
    void callApi('viewStory', { peer, storyId });
  }

  const isUnread = (global.stories.byPeerId[peerId].lastReadId || 0) < story.id;
  if (!isUnread) {
    return;
  }

  const result = await callApi('markStoryRead', {
    peer,
    storyId,
  });

  if (!result) {
    return;
  }

  global = getGlobal();
  global = updateLastReadStoryForPeer(global, peerId, storyId);
  setGlobal(global);
});

addActionHandler('deleteStory', async (global, actions, payload): Promise<void> => {
  const { peerId, storyId } = payload;

  const peer = selectPeer(global, peerId);
  if (!peer) {
    return;
  }

  const result = await callApi('deleteStory', { peer, storyId });

  if (!result) {
    return;
  }

  global = getGlobal();
  global = removePeerStory(global, peerId, storyId);
  setGlobal(global);
});

addActionHandler('toggleStoryPinned', async (global, actions, payload): Promise<void> => {
  const { peerId, storyId, isPinned } = payload;

  const peer = selectPeer(global, peerId);
  if (!peer) {
    return;
  }

  const story = selectPeerStory(global, peerId, storyId);
  const currentIsPinned = story && 'content' in story ? story.isPinned : undefined;
  global = updatePeerStory(global, peerId, storyId, { isPinned });
  global = updatePeerPinnedStory(global, peerId, storyId, isPinned);
  setGlobal(global);

  const result = await callApi('toggleStoryPinned', { peer, storyId, isPinned });
  if (!result) {
    global = getGlobal();
    global = updatePeerStory(global, peerId, storyId, { isPinned: currentIsPinned });
    global = updatePeerPinnedStory(global, peerId, storyId, currentIsPinned);
    setGlobal(global);
  }
});

addActionHandler('loadPeerStories', async (global, actions, payload): Promise<void> => {
  const { peerId } = payload;
  const peer = selectPeer(global, peerId);
  if (!peer) return;

  const result = await callApi('fetchPeerStories', { peer });
  if (!result) {
    return;
  }

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = addChats(global, buildCollectionByKey(result.chats, 'id'));
  global = addStoriesForPeer(global, peerId, result.stories);
  if (result.lastReadStoryId) {
    global = updateLastReadStoryForPeer(global, peerId, result.lastReadStoryId);
  }
  setGlobal(global);
});

addActionHandler('loadPeerPinnedStories', async (global, actions, payload): Promise<void> => {
  const { peerId, offsetId } = payload;
  const peer = selectPeer(global, peerId);
  if (!peer) {
    return;
  }

  const result = await callApi('fetchPeerPinnedStories', { peer, offsetId });
  if (!result) {
    return;
  }

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = addChats(global, buildCollectionByKey(result.chats, 'id'));
  global = addStoriesForPeer(global, peerId, result.stories);
  setGlobal(global);
});

addActionHandler('loadStoriesArchive', async (global, actions, payload): Promise<void> => {
  const { peerId, offsetId } = payload;
  const peer = selectPeer(global, peerId);
  if (!peer) return;

  const result = await callApi('fetchStoriesArchive', { peer, offsetId });
  if (!result) {
    return;
  }

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = addChats(global, buildCollectionByKey(result.chats, 'id'));
  global = addStoriesForPeer(global, peerId, result.stories, true);
  setGlobal(global);
});

addActionHandler('loadPeerStoriesByIds', async (global, actions, payload): Promise<void> => {
  const { peerId, storyIds } = payload;
  const peer = selectPeer(global, peerId);
  if (!peer) {
    return;
  }

  const result = await callApi('fetchPeerStoriesByIds', { peer, ids: storyIds });
  if (!result) {
    return;
  }

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = addChats(global, buildCollectionByKey(result.chats, 'id'));
  global = addStoriesForPeer(global, peerId, result.stories);
  setGlobal(global);
});

addActionHandler('loadStoryViews', async (global, actions, payload): Promise<void> => {
  const {
    peerId,
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

  const peer = selectPeer(global, peerId);
  if (!peer) {
    return;
  }

  if (!isPreload) {
    global = updateStoryViewsLoading(global, true, tabId);
    setGlobal(global);
  }

  const result = await callApi('fetchStoryViewList', {
    peer,
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

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = addChats(global, buildCollectionByKey(result.chats, 'id'));
  if (!isPreload) global = updateStoryViews(global, storyId, result.views, result.nextOffset, tabId);

  if (isPreload && result.views?.length) {
    const recentViewerIds = result.views
      .filter((view): view is ApiStoryView => 'date' in view)
      .map((view) => view.peerId);
    global = updatePeerStoryViews(global, peerId, storyId, {
      recentViewerIds,
      viewsCount: result.viewsCount,
      reactionsCount: result.reactionsCount,
    });
  }
  setGlobal(global);
});

addActionHandler('reportStory', async (global, actions, payload): Promise<void> => {
  const {
    peerId,
    storyId,
    reason,
    description,
    tabId = getCurrentTabId(),
  } = payload;
  const peer = selectPeer(global, peerId);
  if (!peer) {
    return;
  }

  const result = await callApi('reportStory', {
    peer,
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
    peerId,
    storyId,
    privacy,
  } = payload;

  const peer = selectPeer(global, peerId);
  if (!peer) {
    return;
  }

  const allowedIds = [...privacy.allowUserIds, ...privacy.allowChatIds];
  const blockedIds = [...privacy.blockUserIds, ...privacy.blockChatIds];

  const inputPrivacy = buildApiInputPrivacyRules(global, {
    visibility: privacy.visibility,
    isUnspecified: privacy.isUnspecified,
    allowedIds,
    blockedIds,
  });

  void callApi('editStoryPrivacy', {
    peer,
    id: storyId,
    privacy: inputPrivacy,
  });
});

addActionHandler('toggleStoriesHidden', async (global, actions, payload): Promise<void> => {
  const { peerId, isHidden } = payload;
  const peer = selectPeer(global, peerId);
  if (!peer) return;

  const result = await callApi('toggleStoriesHidden', { peer, isHidden });
  if (!result) return;

  global = getGlobal();
  global = updatePeerStoriesHidden(global, peerId, isHidden);
  setGlobal(global);
});

addActionHandler('loadStoriesMaxIds', async (global, actions, payload): Promise<void> => {
  const { peerIds } = payload;
  const peers = peerIds.map((peerId) => selectPeer(global, peerId)).filter(Boolean);
  if (!peers.length) return;

  const result = await callApi('fetchStoriesMaxIds', { peers });
  if (!result) return;

  const peerIdsToLoad: string[] = [];

  global = getGlobal();
  result.forEach((maxId, i) => {
    const peer = peers[i];
    global = updatePeer(global, peer.id, {
      maxStoryId: maxId,
      hasStories: maxId !== 0,
    });

    if (maxId !== 0) {
      peerIdsToLoad.push(peer.id);
    }
  });
  setGlobal(global);

  peerIdsToLoad?.forEach((peerId) => actions.loadPeerStories({ peerId }));
});

addActionHandler('sendStoryReaction', async (global, actions, payload): Promise<void> => {
  const {
    peerId, storyId, containerId, reaction, shouldAddToRecent, tabId = getCurrentTabId(),
  } = payload;
  const peer = selectPeer(global, peerId);
  if (!peer) return;

  const story = selectPeerStory(global, peerId, storyId);
  if (!story || !('content' in story)) return;

  const previousReaction = story.sentReaction;
  global = updateSentStoryReaction(global, peerId, storyId, reaction);
  setGlobal(global);

  if (reaction) {
    actions.startActiveReaction({ containerId, reaction, tabId });
  } else {
    actions.stopActiveReaction({ containerId, tabId });
  }

  const result = await callApi('sendStoryReaction', {
    peer, storyId, reaction, shouldAddToRecent,
  });

  global = getGlobal();
  if (!result) {
    global = updateSentStoryReaction(global, peerId, storyId, previousReaction);
  }
  setGlobal(global);
});

addActionHandler('activateStealthMode', (global, actions, payload): ActionReturnType => {
  const { isForPast = true, isForFuture = true } = payload || {};

  callApi('activateStealthMode', { isForPast: isForPast || true, isForFuture: isForFuture || true });
});
