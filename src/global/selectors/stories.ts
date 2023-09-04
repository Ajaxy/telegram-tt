import type { GlobalState, TabArgs } from '../types';
import type { ApiTypeStory, ApiUserStories } from '../../api/types';
import { getCurrentTabId } from '../../util/establishMultitabRole';
import { selectTabState } from './tabs';

export function selectCurrentViewedStory<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { storyViewer: { userId, storyId } } = selectTabState(global, tabId);

  return { userId, storyId };
}

export function selectIsStoryViewerOpen<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { userId, storyId } = selectCurrentViewedStory(global, tabId);

  return Boolean(userId) && Boolean(storyId);
}

export function selectUserStories<T extends GlobalState>(
  global: T, userId: string,
): ApiUserStories | undefined {
  return global.stories.byUserId[userId];
}

export function selectUserStory<T extends GlobalState>(
  global: T, userId: string, storyId: number,
): ApiTypeStory | undefined {
  return selectUserStories(global, userId)?.byId[storyId];
}

export function selectUserFirstUnreadStoryId<T extends GlobalState>(
  global: T, userId: string,
) {
  const userStories = selectUserStories(global, userId);
  if (!userStories) {
    return undefined;
  }

  if (!userStories.lastReadId) {
    return userStories.orderedIds?.[0];
  }

  const lastReadIndex = userStories.orderedIds.findIndex((id) => id === userStories.lastReadId);

  return userStories.orderedIds?.[lastReadIndex + 1];
}

export function selectUserFirstStoryId<T extends GlobalState>(
  global: T, userId: string,
) {
  return selectUserStories(global, userId)?.orderedIds?.[0];
}
