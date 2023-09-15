import type { ApiPhoto, ApiStory } from '../../api/types';

import { getVideoOrAudioBaseHash } from './messageMedia';

export function getVideoAvatarMediaHash(photo: ApiPhoto) {
  return `videoAvatar${photo.id}?size=u`;
}

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
    const id = media.id;
    const base = `document${id}`;

    if (size === 'download') {
      return `${base}?download`;
    }

    if (size !== 'full') {
      return `${base}?size=m`;
    }

    return getVideoOrAudioBaseHash(media, base);
  }

  const sizeParameter = getSizeParameter(size);

  return `photo${story.content.photo!.id}${sizeParameter}`;
}

function getSizeParameter(size: StorySize) {
  switch (size) {
    case 'download':
      return '?size=z';
    case 'pictogram':
      return '?size=m';
    case 'preview':
      return '?size=x';
    case 'full':
      return '?size=w';
    default:
      return '';
  }
}

export function getStoryKey(chatId: string, storyId: number) {
  return `story${chatId}-${storyId}`;
}
