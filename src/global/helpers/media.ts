import type { ApiStory, ApiVideo } from '../../api/types';

import { getPhotoMediaHash, getVideoMediaHash } from './messageMedia';

type StorySize = 'pictogram' | 'preview' | 'full' | 'download';
const STORY_ALT_VIDEO_WIDTH = 480;

export function getStoryMediaHash(
  story: ApiStory, size: StorySize, isAlt: true,
): string | undefined;
export function getStoryMediaHash(story: ApiStory): string;
export function getStoryMediaHash(story: ApiStory, size: StorySize): string;
export function getStoryMediaHash(
  story: ApiStory, size: StorySize = 'preview', isAlt?: boolean,
) {
  const video = story.content.video;
  const photo = story.content.photo;

  if (video) {
    if (isAlt && !video.altVideos) return undefined;
    const media = isAlt ? getPreferredAlt(video.altVideos!) : video;
    return getVideoMediaHash(media, size);
  }

  if (photo) {
    return getPhotoMediaHash(photo, size);
  }

  return undefined;
}

function getPreferredAlt(alts: ApiVideo[]) {
  const alt = alts.reduce((prev, curr) => (
    Math.abs((curr.width || 0) - STORY_ALT_VIDEO_WIDTH) < Math.abs((prev.width || 0) - STORY_ALT_VIDEO_WIDTH)
      ? curr : prev
  ));
  return alt;
}

export function getStoryKey(chatId: string, storyId: number) {
  return `story${chatId}-${storyId}`;
}
