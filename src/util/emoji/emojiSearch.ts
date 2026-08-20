import type { EmojiData, EmojiModule, EmojiRawData } from './emoji';

import {
  buildCollectionByKey, mapValues, pickTruthy, unique,
} from '../iteratees';
import { MEMO_EMPTY_ARRAY } from '../memo';
import memoized from '../memoized';
import { uncompressEmoji } from './emoji';

export type EmojiLibrary = {
  keywords: string[];
  byKeyword: Record<string, Emoji[]>;
  names: string[];
  byName: Record<string, Emoji[]>;
  byNative: Record<string, Emoji>;
  maxKeyLength: number;
};

const VARIATION_SELECTOR = '\uFE0F';

let emojiDataPromise: Promise<EmojiModule> | undefined;
let emojiRawData: EmojiRawData;
let emojiData: EmojiData;

export async function ensureEmojiData() {
  if (!emojiDataPromise) {
    emojiDataPromise = import('emoji-data-ios/emoji-data.json');
    emojiDataPromise.catch(() => {
      emojiDataPromise = undefined;
    });

    emojiRawData = (await emojiDataPromise).default;

    emojiData = uncompressEmoji(emojiRawData);
  }

  await emojiDataPromise;

  return emojiData;
}

export const prepareEmojiLibraryMemo = memoized(prepareEmojiLibrary);
export const searchEmojiLibraryMemo = memoized(searchEmojiLibrary);

function prepareEmojiLibrary(
  byId: Record<string, Emoji>,
  baseEmojiKeywords?: Record<string, string[]>,
  emojiKeywords?: Record<string, string[]>,
): EmojiLibrary {
  const emojis = Object.values(byId);
  const byNative = buildCollectionByKey<Emoji>(emojis, 'native');
  emojis.forEach((emoji) => {
    const plain = emoji.native.replace(VARIATION_SELECTOR, '');
    byNative[plain] ||= emoji;
  });
  const baseEmojisByKeyword = baseEmojiKeywords
    ? mapValues(baseEmojiKeywords, (natives) => Object.values(pickTruthy(byNative, natives)))
    : {};
  const emojisByKeyword = emojiKeywords
    ? mapValues(emojiKeywords, (natives) => Object.values(pickTruthy(byNative, natives)))
    : {};
  const byKeyword = { ...baseEmojisByKeyword, ...emojisByKeyword };
  const keywords = [...Object.keys(baseEmojisByKeyword), ...Object.keys(emojisByKeyword)];
  const byName = emojis.reduce((result, emoji) => {
    emoji.names.forEach((name) => {
      (result[name] ||= []).push(emoji);
    });
    return result;
  }, {} as Record<string, Emoji[]>);
  const names = Object.keys(byName);

  return {
    byKeyword,
    keywords,
    byName,
    names,
    byNative,
    maxKeyLength: [...keywords, ...names].reduce((max, key) => Math.max(max, key.length), 0),
  };
}

function searchEmojiLibrary(library: EmojiLibrary, filter: string, limit: number) {
  const exactNative = library.byNative[filter] || library.byNative[filter.replace(VARIATION_SELECTOR, '')];

  if (filter.length > library.maxKeyLength) {
    return exactNative ? [exactNative] : MEMO_EMPTY_ARRAY;
  }

  const matchedKeywords = library.keywords.filter((keyword) => keyword.startsWith(filter)).sort();
  const matchedNames = library.names.filter((name) => name.startsWith(filter));
  const matched = unique([
    ...(exactNative ? [exactNative] : []),
    ...Object.values(pickTruthy(library.byKeyword, matchedKeywords)).flat(),
    ...Object.values(pickTruthy(library.byName, matchedNames)).flat(),
  ]);
  return matched.length ? matched.slice(0, limit) : MEMO_EMPTY_ARRAY;
}
