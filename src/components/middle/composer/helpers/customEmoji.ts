import type { ApiMessageEntityCustomEmoji, ApiSticker } from '../../../../api/types';
import { ApiMessageEntityTypes } from '../../../../api/types';

import { EMOJI_SIZES } from '../../../../config';
import { REM } from '../../../common/helpers/mediaDimensions';
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
    data-entity-type="${ApiMessageEntityTypes.CustomEmoji}"
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
    data-entity-type="${ApiMessageEntityTypes.CustomEmoji}"
    src="${mediaData || placeholderSrc}"
  />`;
}

export function getCustomEmojiSize(maxEmojisInLine?: number): number | undefined {
  if (!maxEmojisInLine) return undefined;

  // Should be the same as in _message-content.scss
  if (maxEmojisInLine > EMOJI_SIZES) return REM * 2.25;
  return (6 - (maxEmojisInLine * 0.5)) * REM;
}
