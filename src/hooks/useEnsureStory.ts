import { useEffect, useMemo } from '../lib/teact/teact';
import { getActions } from '../global';

import type { ApiTypeStory } from '../api/types';

import { throttle } from '../util/schedulers';

const THROTTLE_THRESHOLD_MS = 200;

function useEnsureStory(
  userId?: string,
  storyId?: number,
  story?: ApiTypeStory,
) {
  const { loadUserStoriesByIds } = getActions();

  const loadStoryThrottled = useMemo(() => {
    const throttled = throttle(loadUserStoriesByIds, THROTTLE_THRESHOLD_MS, true);
    return () => {
      throttled({ userId: userId!, storyIds: [storyId!] });
    };
  }, [storyId, userId]);

  useEffect(() => {
    const shouldLoadStory = !story || !('content' in story || 'isDeleted' in story);
    if (userId && storyId && shouldLoadStory) {
      loadStoryThrottled();
    }
  }, [loadStoryThrottled, story, storyId, userId]);
}

export default useEnsureStory;
