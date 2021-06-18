import {
  useCallback, useEffect, useMemo, useState,
} from '../../../../lib/teact/teact';

import { EDITABLE_INPUT_ID } from '../../../../config';
import { IS_MOBILE_SCREEN } from '../../../../util/environment';
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

let RE_NOT_EMOJI_SEARCH: RegExp;
const EMOJIS_LIMIT = 36;
const FILTER_MIN_LENGTH = 2;

try {
  RE_NOT_EMOJI_SEARCH = new RegExp('[^-_:\\p{L}\\p{N}]+', 'iu');
} catch (e) {
  // Support for older versions of firefox
  RE_NOT_EMOJI_SEARCH = new RegExp('[^-_:\\d\\wа-яё]+', 'i');
}

export default function useEmojiTooltip(
  isAllowed: boolean,
  html: string,
  recentEmojiIds: string[],
  inputId = EDITABLE_INPUT_ID,
  onUpdateHtml: (html: string) => void,
  emojiKeywords?: Record<string, string[]>,
) {
  const [isOpen, markIsOpen, unmarkIsOpen] = useFlag();

  const [byId, setById] = useState<Record<string, Emoji> | undefined>();
  const [keywords, setKeywords] = useState<string[]>();
  const [byKeyword, setByKeyword] = useState<Record<string, Emoji[]>>({});
  const [names, setNames] = useState<string[]>();
  const [byName, setByName] = useState<Record<string, Emoji[]>>({});

  const [filteredEmojis, setFilteredEmojis] = useState<Emoji[]>([]);

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
    const exec = () => {
      setById(emojiData.emojis);
    };

    if (emojiData) {
      exec();
    } else {
      ensureEmojiData()
        .then(exec);
    }
  }, []);

  useEffect(() => {
    if (!byId) {
      return;
    }

    const emojis = Object.values(byId);

    if (emojiKeywords) {
      const byNative = buildCollectionByKey(emojis, 'native');
      const emojisByKeyword = mapValues(emojiKeywords, (natives) => {
        return Object.values(pickTruthy(byNative, natives));
      });
      setByKeyword(emojisByKeyword);
      setKeywords(Object.keys(emojisByKeyword));
    }

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
  }, [byId, emojiKeywords]);

  useEffect(() => {
    if (!isAllowed || !html || !byId) {
      unmarkIsOpen();
      return;
    }

    const code = getEmojiCode(html);
    if (!code) {
      setFilteredEmojis([]);
      unmarkIsOpen();
      return;
    }

    const filter = code.substr(1);
    let matched: Emoji[] = [];

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
      markIsOpen();
      setFilteredEmojis(matched.slice(0, EMOJIS_LIMIT));
    } else {
      unmarkIsOpen();
    }
  }, [
    byId, byKeyword, keywords, byName, names,
    html, isAllowed, markIsOpen, recentEmojis, unmarkIsOpen,
  ]);

  const insertEmoji = useCallback((textEmoji: string) => {
    const atIndex = html.lastIndexOf(':');
    if (atIndex !== -1) {
      onUpdateHtml(`${html.substr(0, atIndex)}${textEmoji}`);
      const messageInput = document.getElementById(inputId)!;
      if (!IS_MOBILE_SCREEN) {
        requestAnimationFrame(() => {
          focusEditableElement(messageInput, true);
        });
      }
    }

    unmarkIsOpen();
  }, [html, inputId, onUpdateHtml, unmarkIsOpen]);

  return {
    isEmojiTooltipOpen: isOpen,
    closeEmojiTooltip: unmarkIsOpen,
    filteredEmojis,
    insertEmoji,
  };
}

function getEmojiCode(html: string) {
  const tempEl = document.createElement('div');
  tempEl.innerHTML = html.replace('<br>', '\n');
  const text = tempEl.innerText;

  const lastSymbol = text[text.length - 1];
  const lastWord = text.split(RE_NOT_EMOJI_SEARCH).pop();

  if (
    !text.length || RE_NOT_EMOJI_SEARCH.test(lastSymbol)
    || !lastWord || !lastWord.startsWith(':')
  ) {
    return undefined;
  }

  return lastWord.toLowerCase();
}

async function ensureEmojiData() {
  if (!emojiDataPromise) {
    emojiDataPromise = import('emoji-data-ios/emoji-data.json') as unknown as Promise<EmojiModule>;
    emojiRawData = (await emojiDataPromise).default;

    emojiData = uncompressEmoji(emojiRawData);
  }

  return emojiDataPromise;
}
