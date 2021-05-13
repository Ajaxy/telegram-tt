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

const RE_NOT_EMOJI_SEARCH = /[^-_:\p{L}\p{N}]+/iu;
const EMOJIS_LIMIT = 36;

export default function useEmojiTooltip(
  isAllowed: boolean,
  html: string,
  recentEmojiIds: string[],
  inputId = EDITABLE_INPUT_ID,
  onUpdateHtml: (html: string) => void,
) {
  const [isOpen, markIsOpen, unmarkIsOpen] = useFlag();
  const [emojiIds, setEmojiIds] = useState<string[]>([]);
  const [filteredEmojis, setFilteredEmojis] = useState<Emoji[]>([]);

  const recentEmojis = useMemo(
    () => {
      if (!emojiIds.length || !recentEmojiIds.length) {
        return [];
      }

      return recentEmojiIds
        .map((emojiId) => emojiData.emojis[emojiId])
        .filter<Emoji>(Boolean as any);
    },
    [emojiIds, recentEmojiIds],
  );

  // Initialize data on first render.
  useEffect(() => {
    const exec = () => {
      setEmojiIds(Object.keys(emojiData.emojis));
    };

    if (emojiData) {
      exec();
    } else {
      ensureEmojiData()
        .then(exec);
    }
  }, []);

  useEffect(() => {
    if (!isAllowed || !html || !emojiIds.length) {
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
    const matched = filter === ''
      ? recentEmojis
      : emojiIds
        .filter((emojiId) => emojiData.emojis[emojiId].names.find((name) => name.includes(filter)))
        .slice(0, EMOJIS_LIMIT)
        .map((emojiId) => emojiData.emojis[emojiId]);

    if (matched.length) {
      markIsOpen();
      setFilteredEmojis(matched);
    } else {
      unmarkIsOpen();
    }
  }, [emojiIds, html, isAllowed, markIsOpen, recentEmojis, unmarkIsOpen]);

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
