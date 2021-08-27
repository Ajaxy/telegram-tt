import EMOJI_REGEX from "../lib/twemojiRegex";
import { fixNonStandardEmoji } from "./emoji";

export function formatInteger(value: number) {
  return String(value).replace(/\d(?=(\d{3})+$)/g, '$& ');
}

function formatFixedNumber(number: number) {
  const fixed = String(number.toFixed(1));
  if (fixed.substr(-2) === '.0') {
    return Math.round(number);
  }

  return number.toFixed(1).replace('.', ',');
}

export function formatIntegerCompact(views: number) {
  if (views < 1e3) {
    return views;
  }

  if (views < 1e6) {
    return `${formatFixedNumber(views / 1e3)}K`;
  }

  return `${formatFixedNumber(views / 1e6)}M`;
}

export function getFirstLetters(phrase: string, count = 2) {
  return phrase
    .replace(/[.,!@#$%^&*()_+=\-`~[\]/\\{}:"|<>?]+/gi, '')
    .trim()
    .split(/\s+/)
    .slice(0, count)
    .map((word: string) => {
      if (!word.length) return '';
      word = fixNonStandardEmoji(word);
      const emojis = word.match(EMOJI_REGEX);
      if (emojis && word.startsWith(emojis[0])) {
        return emojis[0];
      }
      return word.match(/./u)![0].toUpperCase()
    })
    .join('');
}
