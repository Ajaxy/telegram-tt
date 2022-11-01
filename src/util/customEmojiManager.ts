import { ApiMediaFormat } from '../api/types';

import { getStickerPreviewHash } from '../global/helpers';
import { notifyCustomEmojiRender } from '../hooks/useEnsureCustomEmoji';
import * as mediaLoader from './mediaLoader';
import { throttle } from './schedulers';

const DOM_PROCESS_THROTTLE = 500;

function processDomForCustomEmoji() {
  const emojis = document.querySelectorAll<HTMLImageElement>('.custom-emoji.placeholder');
  emojis.forEach((emoji) => {
    const emojiId = emoji.dataset.documentId!;
    const mediaHash = getStickerPreviewHash(emojiId);
    const mediaData = mediaLoader.getFromMemory(mediaHash);
    if (mediaData) {
      emoji.src = mediaData;
      emoji.classList.remove('placeholder');

      notifyCustomEmojiRender(emojiId);
    }
  });
}

export const processMessageInputForCustomEmoji = throttle(processDomForCustomEmoji, DOM_PROCESS_THROTTLE);

export function getCustomEmojiPreviewMediaData(emojiId: string) {
  const mediaHash = getStickerPreviewHash(emojiId);
  const data = mediaLoader.getFromMemory(mediaHash);
  if (data) {
    notifyCustomEmojiRender(emojiId);
    return data;
  }

  mediaLoader.fetch(mediaHash, ApiMediaFormat.BlobUrl).then(() => processMessageInputForCustomEmoji());
  return undefined;
}
