import EMOJI_REGEX from '../../lib/twemojiRegex';
import fixNonStandardEmoji from './fixNonStandardEmoji';

const DETECT_UP_TO = 100;
const MAX_LENGTH = DETECT_UP_TO * 8; // Maximum 8 code points per one emoji.

export default function parseEmojiOnlyString(text: string): number | false {
  const standardizedText = fixNonStandardEmoji(text);
  const lines = standardizedText.split('\n');
  const textWithoutNewlines = lines.join('');
  if (textWithoutNewlines.length > MAX_LENGTH) {
    return false;
  }

  const totalCount = countIfEmojiOnly(textWithoutNewlines);
  if (!totalCount || totalCount > DETECT_UP_TO) {
    return false;
  }

  // Calculate max emoji count per column or line. Used in UI to determine the size of the emoji.
  let max = lines.length;
  for (const line of lines) {
    const count = countIfEmojiOnly(line);
    if (count === false) {
      return false;
    }
    if (count > max) {
      max = count;
    }
  }

  return max;
}

function countIfEmojiOnly(line: string): false | number {
  const iterator = line.matchAll(EMOJI_REGEX);
  let count = 0;
  let currentIndex = 0;

  for (const match of iterator) {
    if (match.index !== currentIndex) {
      return false;
    }

    count++;
    currentIndex = match.index + match[0].length;
  }

  if (currentIndex !== line.length) {
    return false;
  }

  return count;
}
