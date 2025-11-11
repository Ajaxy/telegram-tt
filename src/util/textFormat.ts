import type { LangFn } from './localization';

import EMOJI_REGEX from '../lib/twemojiRegex';
import fixNonStandardEmoji from './emoji/fixNonStandardEmoji';
import { floor } from './math';
import withCache from './withCache';

export function formatInteger(value: number) {
  return String(value).replace(/\d(?=(\d{3})+$)/g, '$& ');
}

export function formatIntegerCompact(lang: LangFn, views: number) {
  if (views < 1e3) {
    return lang.number(views);
  }

  if (views < 1e6) {
    return `${lang.number(floor(views / 1e3, 1))}K`;
  }

  return `${lang.number(floor(views / 1e6, 1))}M`;
}

export function formatPercent(value: number, fractionDigits = 1) {
  return `${Number.isInteger(value) ? value : value.toFixed(fractionDigits)}%`;
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

const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB'] as const;
export function formatFileSize(lang: LangFn, bytes: number, decimals = 1): string {
  if (bytes === 0) {
    return lang('MediaSizeB', { size: 0 }, { pluralValue: 0 });
  }

  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const v = (bytes / (k ** i));
  const value = v.toFixed(Math.max(decimals, 0));

  return lang(`MediaSize${FILE_SIZE_UNITS[i]}`, { size: value }, { pluralValue: v });
}
