import type { ApiTypeStory } from '../../../api/types';
import { ApiMediaFormat } from '../../../api/types';

import { getStoryMediaHash, hasMessageText } from '../../../global/helpers';

import useMedia from '../../../hooks/useMedia';

export default function useStoryProps(
  story?: ApiTypeStory, isCurrentUserPremium = false, isDropdownMenuOpen = false,
) {
  const isLoadedStory = story && 'content' in story;
  const isDeletedStory = story && 'isDeleted' in story;
  const hasText = isLoadedStory ? hasMessageText(story) : false;
  const hasForwardInfo = isLoadedStory && Boolean(story.forwardInfo);

  let thumbnail: string | undefined;
  if (isLoadedStory) {
    if (story.content.photo?.thumbnail) {
      thumbnail = story.content.photo.thumbnail.dataUri;
    }
    if (story.content.video?.thumbnail?.dataUri) {
      thumbnail = story.content.video.thumbnail.dataUri;
    }
  }

  const previewHash = isLoadedStory ? getStoryMediaHash(story) : undefined;
  const previewBlobUrl = useMedia(previewHash);
  const isVideo = Boolean(isLoadedStory && story.content.video);
  const noSound = isLoadedStory && story.content.video?.noSound;
  const fullMediaHash = isLoadedStory ? getStoryMediaHash(story, 'full') : undefined;
  const fullMediaData = useMedia(fullMediaHash, !story, isVideo ? ApiMediaFormat.Progressive : ApiMediaFormat.BlobUrl);
  const altMediaHash = isVideo && isLoadedStory ? getStoryMediaHash(story, 'full', true) : undefined;
  const altMediaData = useMedia(altMediaHash, !story, ApiMediaFormat.Progressive);

  const hasFullData = Boolean(fullMediaData || altMediaData);
  const bestImageData = isVideo ? previewBlobUrl : fullMediaData || previewBlobUrl;
  const hasThumb = !previewBlobUrl && !hasFullData;

  const canDownload = isCurrentUserPremium && isLoadedStory && !story.noForwards;
  const downloadHash = isLoadedStory ? getStoryMediaHash(story, 'download') : undefined;
  const downloadMediaData = useMedia(downloadHash, !canDownload && !isDropdownMenuOpen);

  return {
    isLoadedStory,
    isDeletedStory,
    hasText,
    hasForwardInfo,
    thumbnail,
    previewHash,
    previewBlobUrl,
    isVideo,
    noSound,
    fullMediaHash,
    fullMediaData,
    altMediaHash,
    altMediaData,
    hasFullData,
    bestImageData,
    hasThumb,
    canDownload,
    downloadMediaData,
  };
}
