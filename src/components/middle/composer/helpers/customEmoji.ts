import type { ApiMessageEntityCustomEmoji, ApiSticker } from '../../../../api/types';
import { ApiMessageEntityTypes } from '../../../../api/types';

import { getGlobal } from '../../../../global';
import { EMOJI_SIZES } from '../../../../config';
import { REM } from '../../../common/helpers/mediaDimensions';
import { getInputCustomEmojiParams } from '../../../../util/customEmojiManager';

export const INPUT_CUSTOM_EMOJI_SELECTOR = 'img[data-document-id]';

export function buildCustomEmojiHtml(emoji: ApiSticker) {
  const [isPlaceholder, src, uniqueId] = getInputCustomEmojiParams(emoji);

  return `<img
    class="custom-emoji emoji emoji-small ${isPlaceholder ? 'placeholder' : ''}"
    draggable="false"
    alt="${emoji.emoji}"
    data-document-id="${emoji.id}"
    ${uniqueId ? `data-unique-id="${uniqueId}"` : ''}
    data-entity-type="${ApiMessageEntityTypes.CustomEmoji}"
    src="${src}"
  />`;
}

export function buildCustomEmojiHtmlFromEntity(rawText: string, entity: ApiMessageEntityCustomEmoji) {
  const customEmoji = getGlobal().customEmojis.byId[entity.documentId];
  const [isPlaceholder, src, uniqueId] = getInputCustomEmojiParams(customEmoji);
  return `<img
    class="custom-emoji emoji emoji-small ${isPlaceholder ? 'placeholder' : ''}"
    draggable="false"
    alt="${rawText}"
    data-document-id="${entity.documentId}"
    ${uniqueId ? `data-unique-id="${uniqueId}"` : ''}
    data-entity-type="${ApiMessageEntityTypes.CustomEmoji}"
    src="${src}"
  />`;
}

export function getCustomEmojiSize(maxEmojisInLine?: number): number | undefined {
  if (!maxEmojisInLine) return undefined;

  // Should be the same as in _message-content.scss
  if (maxEmojisInLine > EMOJI_SIZES) return 2.25 * REM;
  if (maxEmojisInLine === 1) return 7 * REM;
  return Math.min(7.5 - (maxEmojisInLine * 0.75), 5.625) * REM;
}
