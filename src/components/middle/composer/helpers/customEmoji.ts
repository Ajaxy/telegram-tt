import type { ApiMessageEntityCustomEmoji, ApiSticker } from '../../../../api/types';
import { getCustomEmojiPreviewMediaData } from '../../../../util/customEmojiManager';

export const INPUT_CUSTOM_EMOJI_SELECTOR = 'img[data-document-id]';

export function buildCustomEmojiHtml(emoji: ApiSticker) {
  const mediaData = getCustomEmojiPreviewMediaData(emoji.id);
  const src = mediaData && `src="${mediaData}"`;
  return `<img
  class="custom-emoji emoji emoji-small"
  draggable="false"
  alt="${emoji.emoji}"
  data-document-id="${emoji.id}"
  ${src} />`;
}

export function buildCustomEmojiHtmlFromEntity(rawText: string, entity: ApiMessageEntityCustomEmoji) {
  const mediaData = getCustomEmojiPreviewMediaData(entity.documentId);
  const src = mediaData && `src="${mediaData}"`;
  return `<img
  class="custom-emoji emoji emoji-small"
  draggable="false"
  alt="${rawText}"
  data-document-id="${entity.documentId}"
  ${src} />`;
}
