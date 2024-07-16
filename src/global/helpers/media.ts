import type { ApiStory } from '../../api/types';

import { getPhotoMediaHash, getVideoMediaHash } from './messageMedia';

type StorySize = 'pictogram' | 'preview' | 'full' | 'download';

export function getStoryMediaHash(
  story: ApiStory, size: StorySize, isAlt: true,
): string | undefined;
export function getStoryMediaHash(story: ApiStory): string;
export function getStoryMediaHash(story: ApiStory, size: StorySize): string;
export function getStoryMediaHash(
  story: ApiStory, size: StorySize = 'preview', isAlt?: boolean,
) {
  const isVideo = Boolean(story.content.video);

  if (isVideo) {
    if (isAlt && !story.content.altVideo) return undefined;
    const media = isAlt ? story.content.altVideo! : story.content.video!;
    return getVideoMediaHash(media, size);
  }

  return getPhotoMediaHash(story.content.photo!, size);
}

export function getStoryKey(chatId: string, storyId: number) {
  return `story${chatId}-${storyId}`;
}
