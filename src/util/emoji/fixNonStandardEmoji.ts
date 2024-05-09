import EMOJI_REGEX from '../../lib/twemojiRegex';

// Non-standard variations of emojis, used on some devices
const EMOJI_EXCEPTIONS: [string | RegExp, string][] = [
  [/\u{1f3f3}\u200d\u{1f308}/gu, '\u{1f3f3}\ufe0f\u200d\u{1f308}'], // 🏳‍🌈
  [/\u{1f3f3}\u200d\u26a7\ufe0f?/gu, '\u{1f3f3}\ufe0f\u200d\u26a7\ufe0f'], // 🏳️‍⚧️
  [/\u26d3\u200d\u{1f4a5}/gu, '\u26d3\ufe0f\u200d\u{1f4a5}'], // ⛓‍💥
  [/\u200d([\u2640\u2642])(?!\ufe0f)/gu, '\u200d$1\ufe0f'], // Gender variation without 0xFE0F
];

export default function fixNonStandardEmoji(text: string) {
  // Non-standard sequences typically parsed as separate emojis, so no need to fix text without any
  if (!text.match(EMOJI_REGEX)) return text;
  // eslint-disable-next-line no-restricted-syntax
  for (const [regex, replacement] of EMOJI_EXCEPTIONS) {
    text = text.replace(regex, replacement);
  }

  return text;
}
