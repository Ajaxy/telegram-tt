import { useEffect, useRef, useState } from '../../../../lib/teact/teact';
import { getGlobal } from '../../../../global';

import type { ApiSticker } from '../../../../api/types';
import type { EmojiData, EmojiModule, EmojiRawData } from '../../../../util/emoji/emoji';
import type { Signal } from '../../../../util/signals';

import { EDITABLE_INPUT_CSS_SELECTOR, EDITABLE_INPUT_ID } from '../../../../config';
import { requestNextMutation } from '../../../../lib/fasterdom/fasterdom';
import { selectCustomEmojiForEmojis } from '../../../../global/selectors';
import { nativeToUnified, uncompressEmoji } from '../../../../util/emoji/emoji';
import focusEditableElement from '../../../../util/focusEditableElement';
import {
  buildCollectionByKey, mapValues, pickTruthy, unique, uniqueByField,
} from '../../../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../../../util/memo';
import memoized from '../../../../util/memoized';
import renderText from '../../../common/helpers/renderText';
import { buildCustomEmojiHtml } from '../helpers/customEmoji';
import { prepareForRegExp } from '../helpers/prepareForRegExp';

import { useThrottledResolver } from '../../../../hooks/useAsyncResolvers';
import useDerivedSignal from '../../../../hooks/useDerivedSignal';
import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';

interface Library {
  keywords: string[];
  byKeyword: Record<string, Emoji[]>;
  keysByPrefix: Record<string, string[]>;
}

let emojiDataPromise: Promise<EmojiModule> | undefined;
let emojiRawData: EmojiRawData;
let emojiData: EmojiData;

let RE_EMOJI_SEARCH: RegExp;
let RE_LOWERCASE_TEST: RegExp;
let RE_EMOJI_WORD_SEARCH: RegExp;
const EMOJIS_LIMIT = 36;
const FILTER_MIN_LENGTH = 2;

const THROTTLE = 250;
const TOOLTIP_OPEN_DEBOUNCE = 250;

const prepareRecentEmojisMemo = memoized(prepareRecentEmojis);
const prepareLibraryMemo = memoized(prepareLibrary);
const searchInLibraryMemo = memoized(searchInLibrary);
const normalizeEmojiNativeMemo = memoized(normalizeEmojiNative);

try {
  RE_EMOJI_SEARCH = /(^|\s):(?!\s)[-+_:'\s\p{L}\p{N}]*$/gui;
  RE_EMOJI_WORD_SEARCH = /^(?![:@/])(?!.*[:@/]).+$/u;
  RE_LOWERCASE_TEST = /\p{Ll}/u;
} catch (e) {
  // Support for older versions of firefox
  RE_EMOJI_SEARCH = /(^|\s):(?!\s)[-+_:'\s\d\wа-яёґєії]*$/gi;
  RE_EMOJI_WORD_SEARCH = /^(?![:@/])(?!.*[:@/]).+$/;
  RE_LOWERCASE_TEST = /[a-zяёґєії]/;
}

export default function useEmojiTooltip(
  isEnabled: boolean,
  getHtml: Signal<string>,
  setHtml: (html: string) => void,
  inputId = EDITABLE_INPUT_ID,
  recentEmojiIds: string[],
  baseEmojiKeywords?: Record<string, string[]>,
  emojiKeywords?: Record<string, string[]>,
) {
  const [isManuallyClosed, markManuallyClosed, unmarkManuallyClosed] = useFlag(false);

  const [byId, setById] = useState<Record<string, Emoji> | undefined>();
  const [filteredEmojis, setFilteredEmojis] = useState<Emoji[]>(MEMO_EMPTY_ARRAY);
  const [filteredCustomEmojis, setFilteredCustomEmojis] = useState<ApiSticker[]>(MEMO_EMPTY_ARRAY);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const filteredEmojiIdsRef = useRef('');
  const filteredCustomEmojiIdsRef = useRef('');
  const openTooltipTimeoutRef = useRef<number | undefined>();

  // Initialize data on first render
  useEffect(() => {
    if (!isEnabled) return;

    function exec() {
      setById(emojiData.emojis);
    }

    if (emojiData) {
      exec();
    } else {
      ensureEmojiData().then(exec);
    }
  }, [isEnabled]);

  const detectEmojiCodeThrottled = useThrottledResolver(() => {
    const html = getHtml();
    if (!isEnabled || !html) return undefined;

    const preparedHtml = prepareForRegExp(html);
    const emojiCode = preparedHtml.includes(':') ? preparedHtml.match(RE_EMOJI_SEARCH)?.[0].trim() : undefined;

    if (emojiCode) {
      return {
        code: emojiCode,
        isColonQuery: true,
      };
    }

    const plainTextQuery = preparedHtml.replace(/^\s*/, '');
    const wordCode = plainTextQuery.match(RE_EMOJI_WORD_SEARCH)?.[0];
    if (wordCode) {
      return {
        code: wordCode,
        isColonQuery: false,
      };
    }

    return undefined;
  }, [getHtml, isEnabled], THROTTLE);

  const getEmojiCode = useDerivedSignal(
    detectEmojiCodeThrottled, [detectEmojiCodeThrottled, getHtml], true,
  );

  const updateFiltered = useLastCallback((emojis: Emoji[]) => {
    const emojiIds = emojis.length ? emojis.map(({ id }) => id).join('\x01') : '';
    if (filteredEmojiIdsRef.current !== emojiIds) {
      filteredEmojiIdsRef.current = emojiIds;
      setFilteredEmojis(emojis);
    }

    if (emojis === MEMO_EMPTY_ARRAY) {
      if (filteredCustomEmojiIdsRef.current) {
        filteredCustomEmojiIdsRef.current = '';
        setFilteredCustomEmojis(MEMO_EMPTY_ARRAY);
      }
      return;
    }

    const nativeEmojis = emojis.map((emoji) => emoji.native);
    const customEmojis = uniqueByField(
      selectCustomEmojiForEmojis(getGlobal(), nativeEmojis),
      'id',
    );
    const customEmojiIds = customEmojis.length ? customEmojis.map(({ id }) => id).join('\x01') : '';
    if (filteredCustomEmojiIdsRef.current !== customEmojiIds) {
      filteredCustomEmojiIdsRef.current = customEmojiIds;
      setFilteredCustomEmojis(customEmojis);
    }
  });

  const insertEmoji = useLastCallback((emoji: string | ApiSticker, isForce = false) => {
    const html = getHtml();
    if (!html) return;

    const emojiCodeData = getEmojiCode();
    const emojiCode = emojiCodeData?.code;
    const isColonQuery = emojiCodeData?.isColonQuery;

    if (!emojiCode) {
      return;
    }

    const emojiHtml = typeof emoji === 'string'
      ? renderText(emoji, ['emoji_html'])[0] as string
      : buildCustomEmojiHtml(emoji);

    if (isColonQuery) {
      const atIndex = html.lastIndexOf(':', isForce ? html.lastIndexOf(':') - 1 : undefined);
      if (atIndex === -1) {
        return;
      }

      setHtml(`${html.substring(0, atIndex)}${emojiHtml}`);
    } else {
      const lowerCaseHtml = html.toLowerCase();
      const lowerCaseQuery = emojiCode.toLowerCase();
      const searchIndex = lowerCaseHtml.lastIndexOf(lowerCaseQuery);

      if (searchIndex === -1) {
        return;
      }

      setHtml(`${html.substring(0, searchIndex)}${emojiHtml}${html.substring(searchIndex + emojiCode.length)}`);
    }

    const messageInput = inputId === EDITABLE_INPUT_ID
      ? document.querySelector<HTMLDivElement>(EDITABLE_INPUT_CSS_SELECTOR)!
      : document.getElementById(inputId) as HTMLDivElement;

    requestNextMutation(() => {
      focusEditableElement(messageInput, true, true);
    });

    updateFiltered(MEMO_EMPTY_ARRAY);
  });

  useEffect(() => {
    const emojiCodeData = getEmojiCode();
    const emojiCode = emojiCodeData?.code;
    const isColonQuery = Boolean(emojiCodeData?.isColonQuery);
    if (!emojiCode || !byId) {
      updateFiltered(MEMO_EMPTY_ARRAY);
      return;
    }

    const newShouldAutoInsert = Boolean(
      emojiCodeData?.isColonQuery && emojiCode.length > 2 && emojiCode.endsWith(':'),
    );

    const filter = isColonQuery
      ? emojiCode.substring(1, newShouldAutoInsert ? 1 + emojiCode.length - 2 : undefined)
      : emojiCode;
    let matched: Emoji[] = MEMO_EMPTY_ARRAY;

    if (!filter) {
      matched = prepareRecentEmojisMemo(byId, recentEmojiIds, EMOJIS_LIMIT);
    } else if ((filter.length === 1 && RE_LOWERCASE_TEST.test(filter)) || filter.length >= FILTER_MIN_LENGTH) {
      const library = prepareLibraryMemo(byId, baseEmojiKeywords, emojiKeywords);
      matched = searchInLibraryMemo(library, filter.toLowerCase(), EMOJIS_LIMIT);
    }

    if (!matched.length) {
      updateFiltered(MEMO_EMPTY_ARRAY);
      return;
    }

    if (newShouldAutoInsert) {
      insertEmoji(matched[0].native, true);
    } else {
      updateFiltered(matched);
    }
  }, [
    baseEmojiKeywords, byId, getEmojiCode, emojiKeywords, insertEmoji, recentEmojiIds, updateFiltered,
  ]);

  useEffect(unmarkManuallyClosed, [unmarkManuallyClosed, getHtml]);

  const html = getHtml();
  const shouldBeOpen = Boolean(filteredEmojis.length || filteredCustomEmojis.length) && !isManuallyClosed;

  useEffect(() => {
    if (openTooltipTimeoutRef.current) {
      clearTimeout(openTooltipTimeoutRef.current);
      openTooltipTimeoutRef.current = undefined;
    }

    if (!shouldBeOpen) {
      setIsTooltipVisible(false);
      return;
    }

    if (isTooltipVisible) {
      return;
    }

    openTooltipTimeoutRef.current = window.setTimeout(() => {
      setIsTooltipVisible(true);
      openTooltipTimeoutRef.current = undefined;
    }, TOOLTIP_OPEN_DEBOUNCE);
  }, [html, isTooltipVisible, shouldBeOpen]);

  useEffect(() => () => {
    if (openTooltipTimeoutRef.current) {
      clearTimeout(openTooltipTimeoutRef.current);
      openTooltipTimeoutRef.current = undefined;
    }
  }, []);

  return {
    isEmojiTooltipOpen: isTooltipVisible,
    closeEmojiTooltip: markManuallyClosed,
    filteredEmojis,
    filteredCustomEmojis,
    insertEmoji,
  };
}

async function ensureEmojiData() {
  if (!emojiDataPromise) {
    emojiDataPromise = import('emoji-data-ios/emoji-data.json');
    emojiRawData = (await emojiDataPromise).default;

    emojiData = uncompressEmoji(emojiRawData);
  }

  return emojiDataPromise;
}

function prepareRecentEmojis(byId: Record<string, Emoji>, recentEmojiIds: string[], limit: number) {
  if (!byId || !recentEmojiIds.length) {
    return MEMO_EMPTY_ARRAY;
  }

  return Object.values(pickTruthy(byId, recentEmojiIds)).slice(0, limit);
}

function prepareLibrary(
  byId: Record<string, Emoji>,
  baseEmojiKeywords?: Record<string, string[]>,
  emojiKeywords?: Record<string, string[]>,
): Library {
  const emojis = Object.values(byId);

  const byNative = buildCollectionByKey<Emoji>(emojis, 'native');
  const byNormalizedNative = emojis.reduce((acc, emoji) => {
    const normalizedNative = normalizeEmojiNativeMemo(emoji.native);
    if (!normalizedNative || acc[normalizedNative]) {
      return acc;
    }

    acc[normalizedNative] = emoji;
    return acc;
  }, {} as Record<string, Emoji>);

  const resolveNatives = (natives: string[]) => {
    const exactMatches = Object.values(pickTruthy(byNative, natives));
    if (exactMatches.length === natives.length) {
      return exactMatches;
    }

    const normalizedMatches = natives.map((native) => {
      return byNative[native] || byNormalizedNative[normalizeEmojiNativeMemo(native)];
    }).filter(Boolean);

    return unique(normalizedMatches);
  };

  const baseEmojisByKeyword = baseEmojiKeywords
    ? mapValues(baseEmojiKeywords, (natives) => {
      return resolveNatives(natives);
    })
    : {};
  const emojisByKeyword = emojiKeywords
    ? mapValues(emojiKeywords, (natives) => {
      return resolveNatives(natives);
    })
    : {};

  const byKeyword = { ...baseEmojisByKeyword, ...emojisByKeyword };
  const keywords = Object.keys(byKeyword);
  const keysByPrefix = buildPrefixIndex(keywords);

  return {
    byKeyword,
    keywords,
    keysByPrefix,
  };
}

function searchInLibrary(library: Library, filter: string, limit: number) {
  const { byKeyword, keysByPrefix } = library;
  const variants = getNormalizedVariants(filter);
  const scoredByKey: Record<string, number> = {};
  variants.forEach((variant) => {
    const prefixedKeys = keysByPrefix[variant];
    if (!prefixedKeys?.length) {
      return;
    }

    prefixedKeys.forEach((key) => {
      const score = key.length - variant.length;
      const prevScore = scoredByKey[key];
      if (prevScore === undefined || score < prevScore) {
        scoredByKey[key] = score;
      }
    });
  });
  const scoredKeys = Object.keys(scoredByKey).map((key) => ({ key, score: scoredByKey[key] }));

  if (!scoredKeys.length) return MEMO_EMPTY_ARRAY;

  scoredKeys.sort((a, b) => a.score - b.score || a.key.length - b.key.length);
  const matched = unique(
    scoredKeys.flatMap(({ key }) => byKeyword[key] || MEMO_EMPTY_ARRAY),
  );

  return matched.length ? matched.slice(0, limit) : MEMO_EMPTY_ARRAY;
}

function getNormalizedVariants(query: string) {
  const normalized = query.toLowerCase().replace(/_/g, ' ').trim();
  if (!normalized) {
    return [] as string[];
  }

  return [normalized];
}

function normalizeEmojiNative(native: string) {
  try {
    // Compare by canonical codepoints while ignoring VS16 variation selectors,
    // including inside ZWJ sequences (e.g. 🤦‍♀️/🤦‍♂️).
    return nativeToUnified(native.normalize('NFC').replace(/\uFE0F/g, ''));
  } catch {
    return native;
  }
}

function buildPrefixIndex(keywords: string[]) {
  const keysByPrefix: Record<string, string[]> = {};

  keywords.forEach((keyword) => {
    for (let i = 1; i <= keyword.length; i++) {
      const prefix = keyword.substring(0, i);
      if (!keysByPrefix[prefix]) {
        keysByPrefix[prefix] = [keyword];
      } else {
        keysByPrefix[prefix].push(keyword);
      }
    }
  });

  return keysByPrefix;
}
