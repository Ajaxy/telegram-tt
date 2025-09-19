import type { ApiPeerStories, ApiTypeStory } from '../../api/types';
import type { GlobalState, TabArgs } from '../types';
import type { ProfileCollectionKey } from './payments';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import { selectPeer } from './peers';
import { selectTabState } from './tabs';

export function selectCurrentViewedStory<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { storyViewer: { peerId, storyId } } = selectTabState(global, tabId);

  return { peerId, storyId };
}

export function selectIsStoryViewerOpen<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { peerId, storyId } = selectCurrentViewedStory(global, tabId);

  return Boolean(peerId) && Boolean(storyId);
}

export function selectPeerStories<T extends GlobalState>(
  global: T, peerId: string,
): ApiPeerStories | undefined {
  return global.stories.byPeerId[peerId];
}

export function selectPeerStory<T extends GlobalState>(
  global: T, peerId: string, storyId: number,
): ApiTypeStory | undefined {
  return selectPeerStories(global, peerId)?.byId[storyId];
}

export function selectPinnedStories<T extends GlobalState>(
  global: T, peerId: string,
) {
  const stories = selectPeerStories(global, peerId);
  if (!stories?.pinnedIds?.length) return undefined;
  return stories.pinnedIds.map((id) => stories.byId[id]).filter((s) => (
    s && 'isInProfile' in s && s.isInProfile
  ));
}

export function selectPeerFirstUnreadStoryId<T extends GlobalState>(
  global: T, peerId: string,
) {
  const peerStories = selectPeerStories(global, peerId);
  if (!peerStories) {
    return undefined;
  }

  if (!peerStories.lastReadId) {
    return peerStories.orderedIds?.[0];
  }

  const lastReadIndex = peerStories.orderedIds.findIndex((id) => id === peerStories.lastReadId);

  return peerStories.orderedIds?.[lastReadIndex + 1];
}

export function selectPeerFirstStoryId<T extends GlobalState>(
  global: T, peerId: string,
) {
  return selectPeerStories(global, peerId)?.orderedIds?.[0];
}

export function selectStoryListForViewer<T extends GlobalState>(
  global: T,
  peerId: string,
  storyId?: number,
  isSingleStory?: boolean,
  isSinglePeer?: boolean,
  isPrivate?: boolean,
  isArchive?: boolean,
): {
  peerIds: string[];
  storyIdsByPeerId: Record<string, number[]>;
} | undefined {
  const currentStoryId = storyId
    || selectPeerFirstUnreadStoryId(global, peerId)
    || selectPeerFirstStoryId(global, peerId);
  if (!currentStoryId) {
    return undefined;
  }

  if (isSingleStory) {
    return {
      peerIds: [peerId],
      storyIdsByPeerId: { [peerId]: [currentStoryId] },
    };
  }

  const peer = selectPeer(global, peerId);
  const story = selectPeerStory(global, peerId, currentStoryId);
  if (!peer || !story) {
    return undefined;
  }

  const isUnread = (global.stories.byPeerId[peerId].lastReadId || 0) < story.id;

  if (isSinglePeer) {
    const storyIds = getPeerStoryIdsForViewer(global, peerId, isUnread, isArchive, isPrivate);

    return storyIds?.length
      ? { peerIds: [peerId], storyIdsByPeerId: { [peerId]: storyIds } }
      : undefined;
  }

  const { orderedPeerIds: { active, archived } } = global.stories;
  const orderedPeerIds = (peer.areStoriesHidden ? archived : active) ?? [];
  const peerIds: string[] = [];
  const storyIdsByPeerId: Record<string, number[]> = {};

  for (const currentPeerId of orderedPeerIds) {
    const storyIds = getPeerStoryIdsForViewer(global, currentPeerId, isUnread, isArchive, isPrivate);
    if (storyIds?.length) {
      peerIds.push(currentPeerId);
      storyIdsByPeerId[currentPeerId] = storyIds;
    }
  }

  return peerIds.length ? { peerIds, storyIdsByPeerId } : undefined;
}

function getPeerStoryIdsForViewer<T extends GlobalState>(
  global: T,
  peerId: string,
  isUnread?: boolean,
  isArchive?: boolean,
  isPrivate?: boolean,
): number[] | undefined {
  const peerStories = selectPeerStories(global, peerId);
  const storySourceProp = isArchive ? 'archiveIds' : isPrivate ? 'profileIds' : 'orderedIds';
  const storyIds = peerStories?.[storySourceProp];

  if (!peerStories || !storyIds?.length) {
    return undefined;
  }

  if (!peerStories.lastReadId || !isUnread) {
    return storyIds.slice();
  }

  const lastReadIndex = storyIds.indexOf(peerStories.lastReadId);
  return (storyIds.length > lastReadIndex + 1)
    ? storyIds.slice(lastReadIndex + 1)
    : undefined;
}

export function selectActiveStoriesCollectionId<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): ProfileCollectionKey {
  return selectTabState(global, tabId).selectedStoryAlbumId || 'all';
}
