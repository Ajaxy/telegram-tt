import type { ApiStoryView } from '../../../api/types';
import type { ActionReturnType } from '../../types';

import { copyTextToClipboard } from '../../../util/clipboard';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { buildCollectionByKey, omit } from '../../../util/iteratees';
import * as langProvider from '../../../util/langProvider';
import { callApi } from '../../../api/gramjs';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { addChats, addStoriesForPeer, addUsers } from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import {
  selectCurrentViewedStory,
  selectPeer,
  selectPeerFirstStoryId,
  selectPeerFirstUnreadStoryId,
  selectPeerStories,
  selectTabState,
} from '../../selectors';
import { fetchChatByUsername } from '../api/chats';

addActionHandler('openStoryViewer', async (global, actions, payload): Promise<void> => {
  const {
    peerId, storyId, isSinglePeer, isSingleStory, isPrivate, isArchive, origin, tabId = getCurrentTabId(),
  } = payload;

  const peer = selectPeer(global, peerId);
  if (!peer) {
    return;
  }

  const tabState = selectTabState(global, tabId);
  const peerStories = selectPeerStories(global, peerId);

  if (storyId && (!peerStories || !peerStories.byId[storyId])) {
    const result = await callApi('fetchPeerStoriesByIds', { peer, ids: [storyId] });

    if (!result) {
      return;
    }
    global = getGlobal();
    global = addUsers(global, buildCollectionByKey(result.users, 'id'));
    global = addChats(global, buildCollectionByKey(result.chats, 'id'));
    global = addStoriesForPeer(global, peerId, result.stories);
  }

  global = updateTabState(global, {
    storyViewer: {
      ...tabState.storyViewer,
      peerId,
      storyId: storyId || selectPeerFirstUnreadStoryId(global, peerId) || selectPeerFirstStoryId(global, peerId),
      isSinglePeer,
      isPrivate,
      isArchive,
      isSingleStory,
      viewModal: undefined,
      origin,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('openStoryViewerByUsername', async (global, actions, payload): Promise<void> => {
  const {
    username, storyId, origin, tabId = getCurrentTabId(),
  } = payload;

  const chat = await fetchChatByUsername(global, username);

  if (!chat) {
    return;
  }

  actions.openStoryViewer({
    peerId: chat.id,
    storyId,
    isSinglePeer: true,
    isSingleStory: true,
    origin,
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
      lastViewedByPeerIds: undefined,
    },
  }, tabId);

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

  const orderedIds = global.stories.orderedPeerIds[isArchived ? 'archived' : 'active'];
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
    peerId, storyId, isSinglePeer, isSingleStory, isPrivate, isArchive,
  } = tabState.storyViewer;

  if (isSingleStory) {
    actions.closeStoryViewer({ tabId });
    return undefined;
  }

  const { orderedPeerIds: { active, archived } } = global.stories;
  if (!peerId || !storyId) {
    return undefined;
  }

  const peer = selectPeer(global, peerId);
  const peerStories = selectPeerStories(global, peerId);
  if (!peerStories || !peer) {
    return undefined;
  }

  const orderedPeerIds = (peer.areStoriesHidden ? archived : active) ?? [];
  const storySourceProp = isArchive ? 'archiveIds' : isPrivate ? 'pinnedIds' : 'orderedIds';
  const peerStoryIds = peerStories[storySourceProp] ?? [];
  const currentStoryIndex = peerStoryIds.indexOf(storyId);
  let previousStoryIndex: number;
  let previousPeerId: string;

  if (currentStoryIndex > 0) {
    previousStoryIndex = currentStoryIndex - 1;
    previousPeerId = peerId;
  } else {
    const previousPeerIdIndex = orderedPeerIds.indexOf(peerId) - 1;
    if (isSinglePeer || previousPeerIdIndex < 0) {
      return undefined;
    }

    previousPeerId = orderedPeerIds[previousPeerIdIndex];
    previousStoryIndex = (selectPeerStories(global, previousPeerId)?.orderedIds.length || 1) - 1;
  }

  const previousStoryId = selectPeerStories(global, previousPeerId)?.[storySourceProp]?.[previousStoryIndex];
  if (!previousStoryId) {
    return undefined;
  }

  return updateTabState(global, {
    storyViewer: {
      ...tabState.storyViewer,
      peerId: previousPeerId,
      storyId: previousStoryId,
    },
  }, tabId);
});

addActionHandler('openNextStory', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const tabState = selectTabState(global, tabId);
  const {
    peerId, storyId, isSinglePeer, isSingleStory, isPrivate, isArchive,
  } = tabState.storyViewer;
  if (isSingleStory) {
    actions.closeStoryViewer({ tabId });
    return undefined;
  }

  const { orderedPeerIds: { active, archived } } = global.stories;
  if (!peerId || !storyId) {
    return undefined;
  }

  const peer = selectPeer(global, peerId);
  const peerStories = selectPeerStories(global, peerId);
  if (!peerStories || !peer) {
    return undefined;
  }

  const orderedPeerIds = (peer.areStoriesHidden ? archived : active) ?? [];
  const storySourceProp = isArchive ? 'archiveIds' : isPrivate ? 'pinnedIds' : 'orderedIds';
  const peerStoryIds = peerStories[storySourceProp] ?? [];
  const currentStoryIndex = peerStoryIds.indexOf(storyId);
  let nextStoryIndex: number;
  let nextPeerId: string;

  if (currentStoryIndex < peerStoryIds.length - 1) {
    nextStoryIndex = currentStoryIndex + 1;
    nextPeerId = peerId;
  } else {
    const nextPeerIdIndex = orderedPeerIds.indexOf(peerId) + 1;
    if (isSinglePeer || nextPeerIdIndex > orderedPeerIds.length - 1) {
      actions.closeStoryViewer({ tabId });
      return undefined;
    }

    nextPeerId = orderedPeerIds[nextPeerIdIndex];
    nextStoryIndex = 0;
  }

  const nextStoryId = selectPeerStories(global, nextPeerId)?.[storySourceProp]?.[nextStoryIndex];
  if (!nextStoryId) {
    return undefined;
  }

  return updateTabState(global, {
    storyViewer: {
      ...tabState.storyViewer,
      peerId: nextPeerId,
      storyId: nextStoryId,
    },
  }, tabId);
});

addActionHandler('openStoryViewModal', (global, actions, payload): ActionReturnType => {
  const { storyId, tabId = getCurrentTabId() } = payload;
  const tabState = selectTabState(global, tabId);

  return updateTabState(global, {
    storyViewer: {
      ...tabState.storyViewer,
      viewModal: {
        storyId,
        nextOffset: '',
        isLoading: true,
      },
    },
  }, tabId);
});

addActionHandler('closeStoryViewModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const tabState = selectTabState(global, tabId);

  return updateTabState(global, {
    storyViewer: omit(tabState.storyViewer, ['viewModal']),
  }, tabId);
});

addActionHandler('copyStoryLink', async (global, actions, payload): Promise<void> => {
  const { peerId, storyId, tabId = getCurrentTabId() } = payload;

  const peer = selectPeer(global, peerId);
  if (!peer) {
    return;
  }

  const link = await callApi('fetchStoryLink', { peer, storyId });
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
  const { storyId, peerId: storyPeerId } = selectCurrentViewedStory(global, tabId);
  const isStoryReply = Boolean(storyId && storyPeerId);

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
      payload: { id: storyPeerId },
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

addActionHandler('toggleStealthModal', (global, actions, payload): ActionReturnType => {
  const { isOpen, tabId = getCurrentTabId() } = payload || {};
  const tabState = selectTabState(global, tabId);

  return updateTabState(global, {
    storyViewer: {
      ...tabState.storyViewer,
      isStealthModalOpen: isOpen,
    },
  }, tabId);
});

addActionHandler('clearStoryViews', (global, actions, payload): ActionReturnType => {
  const { isLoading, tabId = getCurrentTabId() } = payload || {};

  const tabState = selectTabState(global, tabId);

  if (!tabState.storyViewer.viewModal) return global;

  return updateTabState(global, {
    storyViewer: {
      ...tabState.storyViewer,
      viewModal: {
        ...tabState.storyViewer.viewModal,
        viewsById: {},
        isLoading,
        nextOffset: '',
      },
    },
  }, tabId);
});

addActionHandler('updateStoryView', (global, actions, payload): ActionReturnType => {
  const {
    userId, isUserBlocked, areStoriesBlocked, tabId = getCurrentTabId(),
  } = payload;

  const tabState = selectTabState(global, tabId);
  const { viewModal } = tabState.storyViewer;

  if (!viewModal?.viewsById?.[userId]) return global;

  const updatedViewsById: Record<string, ApiStoryView> = {
    ...viewModal.viewsById,
    [userId]: {
      ...viewModal.viewsById[userId],
      isUserBlocked: isUserBlocked || undefined,
      areStoriesBlocked: areStoriesBlocked || undefined,
    },
  };

  return updateTabState(global, {
    storyViewer: {
      ...tabState.storyViewer,
      viewModal: {
        ...viewModal,
        viewsById: updatedViewsById,
      },
    },
  }, tabId);
});

addActionHandler('closeBoostModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    boostModal: undefined,
  }, tabId);
});
