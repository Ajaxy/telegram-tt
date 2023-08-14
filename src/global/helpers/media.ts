import type { ApiPhoto, ApiStory } from '../../api/types';

export function getVideoAvatarMediaHash(photo: ApiPhoto) {
  return `videoAvatar${photo.id}?size=u`;
}

export function getStoryMediaHash(
  story: ApiStory, size: 'pictogram' | 'preview' | 'full', isAlt: true,
): string | undefined;
export function getStoryMediaHash(story: ApiStory): string;
export function getStoryMediaHash(story: ApiStory, size: 'pictogram' | 'preview' | 'full'): string;
export function getStoryMediaHash(
  story: ApiStory, size: 'pictogram' | 'preview' | 'full' = 'preview', isAlt?: boolean,
) {
  const isVideo = Boolean(story.content.video);

  if (isVideo) {
    if (isAlt && !story.content.altVideo) return undefined;
    const id = isAlt ? story.content.altVideo!.id : story.content.video!.id;
    return `document${id}${size === 'full' ? '' : '?size=m'}`;
  }

  const sizeParam = size === 'preview'
    ? '?size=x'
    : (size === 'pictogram' ? '?size=m' : '?size=w');

  return `photo${story.content.photo!.id}${sizeParam}`;
}
