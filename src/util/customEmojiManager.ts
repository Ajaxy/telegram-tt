import { ApiMediaFormat } from '../api/types';

import { getStickerPreviewHash } from '../global/helpers';
import * as mediaLoader from './mediaLoader';
import { throttle } from './schedulers';

const DOM_PROCESS_THROTTLE = 500;

function processDomForCustomEmoji() {
  const emojis = document.querySelectorAll<HTMLImageElement>('img[data-document-id]:not([src])');
  emojis.forEach((emoji) => {
    const mediaHash = getStickerPreviewHash(emoji.dataset.documentId!);
    const mediaData = mediaLoader.getFromMemory(mediaHash);
    if (mediaData) {
      emoji.src = mediaData;
    }
  });
}

export const processMessageInputForCustomEmoji = throttle(processDomForCustomEmoji, DOM_PROCESS_THROTTLE);

export function getCustomEmojiPreviewMediaData(emojiId: string) {
  const mediaHash = getStickerPreviewHash(emojiId);
  const data = mediaLoader.getFromMemory(mediaHash);
  if (data) {
    return data;
  }

  mediaLoader.fetch(mediaHash, ApiMediaFormat.BlobUrl).then(() => processMessageInputForCustomEmoji());
  return undefined;
}
