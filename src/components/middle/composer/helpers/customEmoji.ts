import type { ApiMessageEntityCustomEmoji, ApiSticker } from '../../../../api/types';
import { getCustomEmojiPreviewMediaData } from '../../../../util/customEmojiManager';
import placeholderSrc from '../../../../assets/square.svg';

export const INPUT_CUSTOM_EMOJI_SELECTOR = 'img[data-document-id]';

export function buildCustomEmojiHtml(emoji: ApiSticker) {
  const mediaData = getCustomEmojiPreviewMediaData(emoji.id);

  return `<img
    class="custom-emoji emoji emoji-small${!mediaData ? ' placeholder' : ''}"
    draggable="false"
    alt="${emoji.emoji}"
    data-document-id="${emoji.id}"
    src="${mediaData || placeholderSrc}"
  />`;
}

export function buildCustomEmojiHtmlFromEntity(rawText: string, entity: ApiMessageEntityCustomEmoji) {
  const mediaData = getCustomEmojiPreviewMediaData(entity.documentId);

  return `<img
    class="custom-emoji emoji emoji-small${!mediaData ? ' placeholder' : ''}"
    draggable="false"
    alt="${rawText}"
    data-document-id="${entity.documentId}"
    src="${mediaData || placeholderSrc}"
  />`;
}
