import {
  useCallback, useEffect, useMemo, useState,
} from '../../../../lib/teact/teact';

import { EDITABLE_INPUT_ID } from '../../../../config';
import { IS_MOBILE_SCREEN } from '../../../../util/environment';
import {
  EmojiData, EmojiModule, EmojiRawData, uncompressEmoji,
} from '../../../../util/emoji';
import useFlag from '../../../../hooks/useFlag';
import focusEditableElement from '../../../../util/focusEditableElement';

let emojiDataPromise: Promise<EmojiModule>;
let emojiRawData: EmojiRawData;
let emojiData: EmojiData;

const RE_NOT_EMOJI_SEARCH = /[^-:_a-z\d]+/i;
const EMOJIS_LIMIT = 50;

export default function useEmojiTooltip(
  isAllowed: boolean,
  html: string,
  recentEmojiIds: string[],
  inputId = EDITABLE_INPUT_ID,
  onUpdateHtml: (html: string) => void,
) {
  const [isOpen, markIsOpen, unmarkIsOpen] = useFlag();
  const [emojis, setEmojis] = useState<Emoji[]>([]);
  const [filteredEmojis, setFilteredEmojis] = useState<Emoji[]>([]);

  const recentEmojis = useMemo(
    () => {
      if (!emojis && !recentEmojiIds.length) {
        return [];
      }

      return emojis.filter((emoji) => recentEmojiIds.includes(emoji.id)) as Emoji[];
    },
    [emojis, recentEmojiIds],
  );

  // Initialize data on first render.
  useEffect(() => {
    const exec = () => {
      setEmojis(Object.values(emojiData.emojis));
    };

    if (emojiData) {
      exec();
    } else {
      ensureEmojiData()
        .then(exec);
    }
  }, []);

  useEffect(() => {
    if (!html || !emojis) {
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
    const matched = filter === '' ? recentEmojis : emojis.filter((emoji) => {
      return 'names' in emoji && (!filter || emoji.names.find((name) => name.includes(filter)));
    }) as Emoji[];

    if (matched.length) {
      markIsOpen();
      setFilteredEmojis(matched.slice(0, EMOJIS_LIMIT));
    } else {
      unmarkIsOpen();
    }
  }, [emojis, html, markIsOpen, recentEmojis, unmarkIsOpen]);

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
  tempEl.innerHTML = html;
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
