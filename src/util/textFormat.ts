import type { LangFn } from '../hooks/useLang';

import EMOJI_REGEX from '../lib/twemojiRegex';
import fixNonStandardEmoji from './emoji/fixNonStandardEmoji';
import withCache from './withCache';

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
    return views.toString();
  }

  if (views < 1e6) {
    return `${formatFixedNumber(views / 1e3)}K`;
  }

  return `${formatFixedNumber(views / 1e6)}M`;
}

export const getFirstLetters = withCache((phrase: string, count = 2) => {
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
      return word.match(/./u)![0].toUpperCase();
    })
    .join('');
});

const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB'];
export function formatFileSize(lang: LangFn, bytes: number, decimals = 1): string {
  if (bytes === 0) {
    return lang('FileSize.B', 0);
  }

  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = (bytes / (k ** i)).toFixed(Math.max(decimals, 0));

  return lang(`FileSize.${FILE_SIZE_UNITS[i]}`, value);
}
