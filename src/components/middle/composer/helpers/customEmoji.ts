import { getGlobal } from '../../../../global';

import type { ApiMessageEntityCustomEmoji, ApiSticker } from '../../../../api/types';
import { ApiMessageEntityTypes } from '../../../../api/types';

import { EMOJI_SIZES } from '../../../../config';
import { selectCustomEmoji } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { getInputCustomEmojiParams } from '../../../../util/emoji/customEmojiManager';
import { REM } from '../../../common/helpers/mediaDimensions';

export const INPUT_CUSTOM_EMOJI_SELECTOR = 'img[data-document-id]';

export function buildCustomEmojiHtml(emoji: ApiSticker) {
  const [isPlaceholder, src, uniqueId] = getInputCustomEmojiParams(emoji);

  const className = buildClassName(
    'custom-emoji', 'emoji', 'emoji-small', isPlaceholder && 'placeholder', emoji.shouldUseTextColor && 'colorable',
  );

  return buildCustomEmojiElementHtml(className, emoji.emoji, emoji.id, src, uniqueId);
}

export function buildCustomEmojiHtmlFromEntity(rawText: string, entity: ApiMessageEntityCustomEmoji) {
  const customEmoji = selectCustomEmoji(getGlobal(), entity.documentId);
  const [isPlaceholder, src, uniqueId] = getInputCustomEmojiParams(customEmoji);

  const className = buildClassName(
    'custom-emoji',
    'emoji',
    'emoji-small',
    isPlaceholder && 'placeholder',
    customEmoji?.shouldUseTextColor && 'colorable',
  );

  return buildCustomEmojiElementHtml(className, rawText, entity.documentId, src, uniqueId);
}

export function getCustomEmojiSize(maxEmojisInLine?: number): number | undefined {
  if (!maxEmojisInLine) return undefined;

  // Should be the same as in _message-content.scss
  if (maxEmojisInLine > EMOJI_SIZES) return 2.25 * REM;
  if (maxEmojisInLine === 1) return 7 * REM;
  return Math.min(7.5 - (maxEmojisInLine * 0.75), 5.625) * REM;
}

function buildCustomEmojiElementHtml(
  className: string,
  alt: string | undefined,
  documentId: string,
  src: string,
  uniqueId?: string,
) {
  const img = document.createElement('img');

  img.setAttribute('class', className);
  img.setAttribute('draggable', 'false');
  img.setAttribute('alt', alt || '');
  img.setAttribute('data-document-id', documentId);
  img.setAttribute('data-entity-type', ApiMessageEntityTypes.CustomEmoji);
  img.setAttribute('src', src);

  if (uniqueId) img.setAttribute('data-unique-id', uniqueId);

  return img.outerHTML;
}
