import EMOJI_REGEX from '../../lib/twemojiRegex';
import { nativeToUnifiedExtendedWithCache } from './emoji';
import fixNonStandardEmoji from './fixNonStandardEmoji';

export type EmojiPart = string | { src: string; text: string };

/** `text` as runs of text and emoji images; an image keeps the emoji's source spelling as its text */
export default function splitEmoji(text: string, size: 'big' | 'small'): EmojiPart[] {
  const fixed = fixNonStandardEmoji(text);
  const parts = fixed.split(EMOJI_REGEX);
  const emojis: string[] = fixed.match(EMOJI_REGEX) || [];
  const result: EmojiPart[] = [parts[0]];
  let sourceOffset = parts[0].length;

  emojis.forEach((emoji, i) => {
    // Normalization inserts variation selectors; keep the source spelling for copy and quote offsets
    const sourceStart = sourceOffset;
    for (const character of emoji) {
      if (character !== '\ufe0f' || text[sourceOffset] === character) sourceOffset += character.length;
    }
    const sourceEmoji = text.slice(sourceStart, sourceOffset);
    const code = nativeToUnifiedExtendedWithCache(emoji);
    const src = code && `./img-apple-${size === 'big' ? '160' : '64'}/${code}.png`;
    result.push(src ? { src, text: sourceEmoji } : sourceEmoji);

    const next = parts[i * 2 + 2];
    if (next) {
      result.push(next);
      sourceOffset += next.length;
    }
  });

  return result;
}
