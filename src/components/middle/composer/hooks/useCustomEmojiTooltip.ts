import type { RefObject } from 'react';
import { useCallback, useEffect } from '../../../../lib/teact/teact';
import twemojiRegex from '../../../../lib/twemojiRegex';

import type { ApiSticker } from '../../../../api/types';
import type { Signal } from '../../../../util/signals';

import { getActions } from '../../../../global';
import { EMOJI_IMG_REGEX } from '../../../../config';
import { IS_EMOJI_SUPPORTED } from '../../../../util/environment';
import { getHtmlBeforeSelection } from '../../../../util/selection';
import focusEditableElement from '../../../../util/focusEditableElement';
import { buildCustomEmojiHtml } from '../helpers/customEmoji';

import useDerivedState from '../../../../hooks/useDerivedState';
import useFlag from '../../../../hooks/useFlag';
import useDerivedSignal from '../../../../hooks/useDerivedSignal';
import { useThrottledResolver } from '../../../../hooks/useAsyncResolvers';

const THROTTLE = 300;
const RE_ENDS_ON_EMOJI = new RegExp(`(${twemojiRegex.source})$`, 'g');
const RE_ENDS_ON_EMOJI_IMG = new RegExp(`${EMOJI_IMG_REGEX.source}$`, 'g');

export default function useCustomEmojiTooltip(
  isEnabled: boolean,
  getHtml: Signal<string>,
  setHtml: (html: string) => void,
  getSelectionRange: Signal<Range | undefined>,
  inputRef: RefObject<HTMLDivElement>,
  customEmojis?: ApiSticker[],
) {
  const { loadCustomEmojiForEmoji, clearCustomEmojiForEmoji } = getActions();

  const [isManuallyClosed, markManuallyClosed, unmarkManuallyClosed] = useFlag(false);

  const extractLastEmojiThrottled = useThrottledResolver(() => {
    const html = getHtml();
    if (!isEnabled || !html || !getSelectionRange()?.collapsed) return undefined;

    const hasEmoji = html.match(IS_EMOJI_SUPPORTED ? twemojiRegex : EMOJI_IMG_REGEX);
    if (!hasEmoji) return undefined;

    const htmlBeforeSelection = getHtmlBeforeSelection(inputRef.current!);

    return htmlBeforeSelection.match(IS_EMOJI_SUPPORTED ? RE_ENDS_ON_EMOJI : RE_ENDS_ON_EMOJI_IMG)?.[0];
  }, [getHtml, getSelectionRange, inputRef, isEnabled], THROTTLE);

  const getLastEmoji = useDerivedSignal(
    extractLastEmojiThrottled, [extractLastEmojiThrottled, getHtml, getSelectionRange], true,
  );

  const isActive = useDerivedState(() => Boolean(getLastEmoji()), [getLastEmoji]);
  const hasCustomEmojis = Boolean(customEmojis?.length);

  useEffect(() => {
    if (!isEnabled) return;

    const lastEmoji = getLastEmoji();
    if (lastEmoji) {
      if (!hasCustomEmojis) {
        loadCustomEmojiForEmoji({
          emoji: IS_EMOJI_SUPPORTED ? lastEmoji : lastEmoji.match(/.+alt="(.+)"/)?.[1]!,
        });
      }
    } else {
      clearCustomEmojiForEmoji();
    }
  }, [isEnabled, getLastEmoji, hasCustomEmojis, clearCustomEmojiForEmoji, loadCustomEmojiForEmoji]);

  const insertCustomEmoji = useCallback((emoji: ApiSticker) => {
    const lastEmoji = getLastEmoji();
    if (!isEnabled || !lastEmoji) return;

    const inputEl = inputRef.current!;
    const htmlBeforeSelection = getHtmlBeforeSelection(inputEl);
    const regexText = IS_EMOJI_SUPPORTED
      ? lastEmoji
      // Escape regexp special chars
      : lastEmoji.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${regexText})\\1*$`, '');
    const matched = htmlBeforeSelection.match(regex)![0];
    const count = matched.length / lastEmoji.length;
    const newHtml = htmlBeforeSelection.replace(regex, buildCustomEmojiHtml(emoji).repeat(count));
    const htmlAfterSelection = inputEl.innerHTML.substring(htmlBeforeSelection.length);

    setHtml(`${newHtml}${htmlAfterSelection}`);

    requestAnimationFrame(() => {
      focusEditableElement(inputEl, true, true);
    });
  }, [getLastEmoji, isEnabled, inputRef, setHtml]);

  useEffect(unmarkManuallyClosed, [unmarkManuallyClosed, getHtml]);

  return {
    isCustomEmojiTooltipOpen: Boolean(isActive && hasCustomEmojis && !isManuallyClosed),
    closeCustomEmojiTooltip: markManuallyClosed,
    insertCustomEmoji,
  };
}
