import { useEffect, useMemo } from '../lib/teact/teact';
import { getActions } from '../global';

import type { ApiTypeStory } from '../api/types';

import { throttle } from '../util/schedulers';

const THROTTLE_THRESHOLD_MS = 200;

function useEnsureStory(
  peerId?: string,
  storyId?: number,
  story?: ApiTypeStory,
) {
  const { loadPeerStoriesByIds } = getActions();

  const loadStoryThrottled = useMemo(() => {
    const throttled = throttle(loadPeerStoriesByIds, THROTTLE_THRESHOLD_MS, true);
    return () => {
      throttled({ peerId: peerId!, storyIds: [storyId!] });
    };
  }, [storyId, peerId]);

  useEffect(() => {
    const shouldLoadStory = !story || !('content' in story || 'isDeleted' in story);
    if (peerId && storyId && shouldLoadStory) {
      loadStoryThrottled();
    }
  }, [loadStoryThrottled, story, storyId, peerId]);
}

export default useEnsureStory;
