import {
  useCallback, useEffect, useMemo, useState,
} from '../../../../lib/teact/teact';

import { EDITABLE_INPUT_ID } from '../../../../config';
import { MEMO_EMPTY_ARRAY } from '../../../../util/memo';
import {
  EmojiData, EmojiModule, EmojiRawData, uncompressEmoji,
} from '../../../../util/emoji';
import focusEditableElement from '../../../../util/focusEditableElement';
import {
  buildCollectionByKey, flatten, mapValues, pickTruthy, unique,
} from '../../../../util/iteratees';
import useFlag from '../../../../hooks/useFlag';

let emojiDataPromise: Promise<EmojiModule>;
let emojiRawData: EmojiRawData;
let emojiData: EmojiData;

let RE_EMOJI_SEARCH: RegExp;
const EMOJIS_LIMIT = 36;
const FILTER_MIN_LENGTH = 2;
const RE_BR = /(<br>|<br\s?\/>)/g;
const RE_SPACE = /&nbsp;/g;
const RE_CLEAN_HTML = /(<div>|<\/div>)/gi;

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
  const [keywords, setKeywords] = useState<string[]>();
  const [byKeyword, setByKeyword] = useState<Record<string, Emoji[]>>({});
  const [names, setNames] = useState<string[]>();
  const [byName, setByName] = useState<Record<string, Emoji[]>>({});
  const [shouldForceInsertEmoji, setShouldForceInsertEmoji] = useState(false);

  const [filteredEmojis, setFilteredEmojis] = useState<Emoji[]>(MEMO_EMPTY_ARRAY);

  const recentEmojis = useMemo(
    () => {
      if (!byId || !recentEmojiIds.length) {
        return [];
      }

      return Object.values(pickTruthy(byId, recentEmojiIds));
    },
    [byId, recentEmojiIds],
  );

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
    if (!byId || isDisabled) {
      return;
    }

    const emojis = Object.values(byId);

    const byNative = buildCollectionByKey(emojis, 'native');
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

    setByKeyword({ ...baseEmojisByKeyword, ...emojisByKeyword });
    setKeywords([...Object.keys(baseEmojisByKeyword), ...Object.keys(emojisByKeyword)]);

    const emojisByName = emojis.reduce((result, emoji) => {
      emoji.names.forEach((name) => {
        if (!result[name]) {
          result[name] = [];
        }

        result[name].push(emoji);
      });

      return result;
    }, {} as Record<string, Emoji[]>);
    setByName(emojisByName);
    setNames(Object.keys(emojisByName));
  }, [isDisabled, baseEmojiKeywords, byId, emojiKeywords]);

  useEffect(() => {
    if (!isAllowed || !html || !byId || !keywords || !keywords.length) {
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
    let matched: Emoji[] = [];

    setShouldForceInsertEmoji(forceSend);

    if (!filter) {
      matched = recentEmojis;
    } else if (filter.length >= FILTER_MIN_LENGTH) {
      const matchedKeywords = keywords.filter((keyword) => keyword.startsWith(filter)).sort();
      matched = matched.concat(flatten(Object.values(pickTruthy(byKeyword, matchedKeywords))));

      // Also search by names, which is useful for non-English languages
      const matchedNames = names.filter((name) => name.startsWith(filter));
      matched = matched.concat(flatten(Object.values(pickTruthy(byName, matchedNames))));

      matched = unique(matched);
    }

    if (matched.length) {
      if (!forceSend) {
        markIsOpen();
      }
      setFilteredEmojis(matched.slice(0, EMOJIS_LIMIT));
    } else {
      unmarkIsOpen();
    }
  }, [
    byId, byKeyword, keywords, byName, names, html, isAllowed, markIsOpen,
    recentEmojis, unmarkIsOpen, setShouldForceInsertEmoji,
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
  const emojis = html
    .replace(RE_SPACE, ' ')
    .replace(RE_BR, '\n')
    .replace(/\n$/i, '')
    .replace(RE_CLEAN_HTML, '')
    .match(RE_EMOJI_SEARCH);

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
