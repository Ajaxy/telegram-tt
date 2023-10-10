import type { ApiPeerStories, ApiTypeStory } from '../../api/types';
import type { GlobalState, TabArgs } from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
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
