import twemojiRegex from '../lib/twemojiRegex';

const DETECT_UP_TO = 100;
const MAX_LENGTH = DETECT_UP_TO * 8; // Maximum 8 per one emoji.
const RE_EMOJI_ONLY = new RegExp(`^(?:${twemojiRegex.source})+$`, '');

const parseEmojiOnlyString = (text: string): number | false => {
  const lines = text.split('\n');
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

  if (countPerLine.some((count) => count === -1)) return false;

  return Math.max(...countPerLine);
};

export default parseEmojiOnlyString;
