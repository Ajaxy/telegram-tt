import { useEffect } from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import { ApiMediaFormat } from '../../../api/types';

import { selectUserStories } from '../../../global/selectors';
import { getStoryMediaHash } from '../../../global/helpers';
import * as mediaLoader from '../../../util/mediaLoader';
import { pause } from '../../../util/schedulers';

const preloadedStories: Record<string, Set<number>> = {};
const USER_STORIES_FOR_PRELOAD = 5;
const PROGRESSIVE_PRELOAD_DURATION = 1000;

const FIRST_PRELOAD_DELAY = 1000;
const canPreload = pause(FIRST_PRELOAD_DELAY);

function useStoryPreloader(userIds: string[]): void;
function useStoryPreloader(userId: string, aroundStoryId?: number): void;
function useStoryPreloader(userId: string | string[], aroundStoryId?: number) {
  useEffect(() => {
    const preloadHashes = async (mediaHashes: { hash: string; format: ApiMediaFormat }[]) => {
      await canPreload;
      mediaHashes.forEach(({ hash, format }) => {
        mediaLoader.fetch(hash, format).then((result) => {
          if (format === ApiMediaFormat.Progressive) {
            preloadProgressive(result);
          }
        });
      });
    };

    const userIds = Array.isArray(userId) ? userId : [userId];

    userIds.forEach((id) => {
      const storyId = aroundStoryId || getGlobal().stories.byUserId[id]?.orderedIds?.[0];
      if (!storyId) return;
      preloadHashes(getPreloadMediaHashes(id, storyId));
    });
  }, [aroundStoryId, userId]);
}

function findIdsAroundCurrentId<T>(ids: T[], currentId: T, aroundAmount: number): T[] {
  const currentIndex = ids.indexOf(currentId);

  return ids.slice(currentIndex - aroundAmount, currentIndex + aroundAmount);
}

function getPreloadMediaHashes(userId: string, storyId: number) {
  const userStories = selectUserStories(getGlobal(), userId);
  if (!userStories || !userStories.orderedIds?.length) {
    return [];
  }

  const preloadIds = findIdsAroundCurrentId(userStories.orderedIds, storyId, USER_STORIES_FOR_PRELOAD);

  const mediaHashes: { hash: string; format: ApiMediaFormat }[] = [];
  preloadIds.forEach((currentStoryId) => {
    if (preloadedStories[userId]?.has(currentStoryId)) {
      return;
    }

    const story = userStories.byId[currentStoryId];
    if (!story || !('content' in story)) {
      return;
    }

    // Media
    mediaHashes.push({
      hash: getStoryMediaHash(story, 'full'),
      format: story.content.video ? ApiMediaFormat.Progressive : ApiMediaFormat.BlobUrl,
    });
    // Thumbnail
    mediaHashes.push({ hash: getStoryMediaHash(story), format: ApiMediaFormat.BlobUrl });
    // Alt video with different codec
    if (story.content.altVideo) {
      mediaHashes.push({ hash: getStoryMediaHash(story, 'full', true)!, format: ApiMediaFormat.Progressive });
    }

    preloadedStories[userId] = (preloadedStories[userId] || new Set()).add(currentStoryId);
  });

  return mediaHashes;
}

function preloadProgressive(url: string) {
  const head = document.head;
  const video = document.createElement('video');
  video.preload = 'auto';
  video.src = url;
  video.muted = true;
  video.autoplay = true;
  video.style.display = 'none';
  head.appendChild(video);

  setTimeout(() => {
    head.removeChild(video);
  }, PROGRESSIVE_PRELOAD_DURATION);
}

export default useStoryPreloader;
