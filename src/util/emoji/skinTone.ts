export type EmojiFitzModifier = 0 | 1 | 2 | 3 | 4 | 5;

const EMOJI_SKIN_TONE_PATTERN = /[\u{1F3FB}-\u{1F3FF}]/gu;

const FITZ_MODIFIER_BY_SKIN_TONE: Record<string, EmojiFitzModifier> = {
  '\u{1F3FB}': 1,
  '\u{1F3FC}': 2,
  '\u{1F3FD}': 3,
  '\u{1F3FE}': 4,
  '\u{1F3FF}': 5,
};

export function getEmojiFitzModifier(emoji: string): EmojiFitzModifier {
  const skinTones = emoji.match(EMOJI_SKIN_TONE_PATTERN);
  if (!skinTones) return 0;

  const fitzModifier = FITZ_MODIFIER_BY_SKIN_TONE[skinTones[0]];
  return skinTones.every((skinTone) => FITZ_MODIFIER_BY_SKIN_TONE[skinTone] === fitzModifier)
    ? fitzModifier
    : 0;
}

export function hasMixedEmojiSkinTones(emoji: string) {
  const skinTones = emoji.match(EMOJI_SKIN_TONE_PATTERN);
  if (!skinTones) return false;

  return skinTones.some((skinTone) => skinTone !== skinTones[0]);
}

export function removeEmojiSkinTone(emoji: string) {
  return emoji.replace(EMOJI_SKIN_TONE_PATTERN, '');
}
