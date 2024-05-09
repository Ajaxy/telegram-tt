import twemojiRegex from '../../lib/twemojiRegex';
import fixNonStandardEmoji from './fixNonStandardEmoji';

const DETECT_UP_TO = 100;
const MAX_LENGTH = DETECT_UP_TO * 8; // Maximum 8 per one emoji.
const RE_EMOJI_ONLY = new RegExp(`^(?:${twemojiRegex.source})+$`, '');

const parseEmojiOnlyString = (text: string): number | false => {
  const standardizedText = fixNonStandardEmoji(text);
  const lines = standardizedText.split('\n');
  const textWithoutNewlines = lines.join('');
  if (textWithoutNewlines.length > MAX_LENGTH) {
    return false;
  }

  const isEmojiOnly = Boolean(textWithoutNewlines.match(RE_EMOJI_ONLY));
  if (!isEmojiOnly) {
    return false;
  }
  const countPerLine = lines.map((line) => {
    let emojiCount = 0;
    while (twemojiRegex.exec(line)) {
      emojiCount++;

      if (emojiCount > DETECT_UP_TO) {
        twemojiRegex.lastIndex = 0;
        return -1;
      }
    }

    return emojiCount;
  });

  let max = lines.length;
  for (let i = 0; i < countPerLine.length; i++) {
    if (countPerLine[i] === -1) {
      return false;
    }
    if (countPerLine[i] > max) {
      max = countPerLine[i];
    }
  }

  return max;
};

export default parseEmojiOnlyString;
