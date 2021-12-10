import {
  useCallback, useEffect, useState,
} from '../../../../lib/teact/teact';

import { EDITABLE_INPUT_ID } from '../../../../config';
import { MEMO_EMPTY_ARRAY } from '../../../../util/memo';
import { prepareForRegExp } from '../helpers/prepareForRegExp';
import {
  EmojiData, EmojiModule, EmojiRawData, uncompressEmoji,
} from '../../../../util/emoji';
import focusEditableElement from '../../../../util/focusEditableElement';
import {
  buildCollectionByKey, flatten, mapValues, pickTruthy, unique,
} from '../../../../util/iteratees';
import memoized from '../../../../util/memoized';
import useFlag from '../../../../hooks/useFlag';

interface Library {
  keywords: string[];
  byKeyword: Record<string, Emoji[]>;
  names: string[];
  byName: Record<string, Emoji[]>;
}

let emojiDataPromise: Promise<EmojiModule>;
let emojiRawData: EmojiRawData;
let emojiData: EmojiData;

let RE_EMOJI_SEARCH: RegExp;
const EMOJIS_LIMIT = 36;
const FILTER_MIN_LENGTH = 2;

const prepareRecentEmojisMemo = memoized(prepareRecentEmojis);
const prepareLibraryMemo = memoized(prepareLibrary);
const searchInLibraryMemo = memoized(searchInLibrary);

try {
  RE_EMOJI_SEARCH = new RegExp('(^|\\s):[-+_:\\p{L}\\p{N}]*$', 'gui');
} catch (e) {
  // Support for older versions of firefox
  RE_EMOJI_SEARCH = new RegExp('(^|\\s):[-+_:\\d\\wа-яё]*$', 'gi');
}

export default function useEmojiTooltip(
  isAllowed: boolean,
  html: string,
  recentEmojiIds: string[],
  inputId = EDITABLE_INPUT_ID,
  onUpdateHtml: (html: string) => void,
  baseEmojiKeywords?: Record<string, string[]>,
  emojiKeywords?: Record<string, string[]>,
  isDisabled = false,
) {
  const [isOpen, markIsOpen, unmarkIsOpen] = useFlag();
  const [byId, setById] = useState<Record<string, Emoji> | undefined>();
  const [shouldForceInsertEmoji, setShouldForceInsertEmoji] = useState(false);
  const [filteredEmojis, setFilteredEmojis] = useState<Emoji[]>(MEMO_EMPTY_ARRAY);

  // Initialize data on first render.
  useEffect(() => {
    if (isDisabled) return;
    const exec = () => {
      setById(emojiData.emojis);
    };

    if (emojiData) {
      exec();
    } else {
      ensureEmojiData()
        .then(exec);
    }
  }, [isDisabled]);

  useEffect(() => {
    if (!isAllowed || !html || !byId || isDisabled) {
      unmarkIsOpen();
      return;
    }

    const code = html.includes(':') && getEmojiCode(html);
    if (!code) {
      setFilteredEmojis(MEMO_EMPTY_ARRAY);
      unmarkIsOpen();
      return;
    }

    const forceSend = code.length > 2 && code.endsWith(':');
    const filter = code.substr(1, forceSend ? code.length - 2 : undefined);
    let matched: Emoji[] = MEMO_EMPTY_ARRAY;

    setShouldForceInsertEmoji(forceSend);

    if (!filter) {
      matched = prepareRecentEmojisMemo(byId, recentEmojiIds, EMOJIS_LIMIT);
    } else if (filter.length >= FILTER_MIN_LENGTH) {
      const library = prepareLibraryMemo(byId, baseEmojiKeywords, emojiKeywords);
      matched = searchInLibraryMemo(library, filter, EMOJIS_LIMIT);
    }

    if (matched.length) {
      if (!forceSend) {
        markIsOpen();
      }
      setFilteredEmojis(matched);
    } else {
      unmarkIsOpen();
    }
  }, [
    byId, html, isAllowed, markIsOpen, recentEmojiIds, unmarkIsOpen, setShouldForceInsertEmoji,
    isDisabled, baseEmojiKeywords, emojiKeywords,
  ]);

  const insertEmoji = useCallback((textEmoji: string, isForce?: boolean) => {
    const atIndex = html.lastIndexOf(':', isForce ? html.lastIndexOf(':') - 1 : undefined);
    if (atIndex !== -1) {
      onUpdateHtml(`${html.substr(0, atIndex)}${textEmoji}`);
      const messageInput = document.getElementById(inputId)!;
      requestAnimationFrame(() => {
        focusEditableElement(messageInput, true);
      });
    }

    unmarkIsOpen();
  }, [html, inputId, onUpdateHtml, unmarkIsOpen]);

  useEffect(() => {
    if (isOpen && shouldForceInsertEmoji && filteredEmojis.length) {
      insertEmoji(filteredEmojis[0].native, true);
    }
  }, [filteredEmojis, insertEmoji, isOpen, shouldForceInsertEmoji]);

  return {
    isEmojiTooltipOpen: isOpen,
    closeEmojiTooltip: unmarkIsOpen,
    filteredEmojis,
    insertEmoji,
  };
}

function getEmojiCode(html: string) {
  const emojis = prepareForRegExp(html).match(RE_EMOJI_SEARCH);

  return emojis ? emojis[0].trim() : undefined;
}

async function ensureEmojiData() {
  if (!emojiDataPromise) {
    emojiDataPromise = import('emoji-data-ios/emoji-data.json') as unknown as Promise<EmojiModule>;
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
  const baseEmojisByKeyword = baseEmojiKeywords
    ? mapValues(baseEmojiKeywords, (natives) => {
      return Object.values(pickTruthy(byNative, natives));
    })
    : {};
  const emojisByKeyword = emojiKeywords
    ? mapValues(emojiKeywords, (natives) => {
      return Object.values(pickTruthy(byNative, natives));
    })
    : {};

  const byKeyword = { ...baseEmojisByKeyword, ...emojisByKeyword };
  const keywords = ([] as string[]).concat(Object.keys(baseEmojisByKeyword), Object.keys(emojisByKeyword));

  const byName = emojis.reduce((result, emoji) => {
    emoji.names.forEach((name) => {
      if (!result[name]) {
        result[name] = [];
      }

      result[name].push(emoji);
    });

    return result;
  }, {} as Record<string, Emoji[]>);

  const names = Object.keys(byName);

  return {
    byKeyword,
    keywords,
    byName,
    names,
  };
}

function searchInLibrary(library: Library, filter: string, limit: number) {
  const {
    byKeyword, keywords, byName, names,
  } = library;

  let matched: Emoji[] = MEMO_EMPTY_ARRAY;

  const matchedKeywords = keywords.filter((keyword) => keyword.startsWith(filter)).sort();
  matched = matched.concat(flatten(Object.values(pickTruthy(byKeyword!, matchedKeywords))));

  // Also search by names, which is useful for non-English languages
  const matchedNames = names.filter((name) => name.startsWith(filter));
  matched = matched.concat(flatten(Object.values(pickTruthy(byName, matchedNames))));

  matched = unique(matched);

  return matched.slice(0, limit);
}
