import { useCallback, useEffect, useState } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiSticker } from '../../../../api/types';

import { EMOJI_IMG_REGEX } from '../../../../config';
import { IS_EMOJI_SUPPORTED } from '../../../../util/environment';
import { getHtmlBeforeSelection } from '../../../../util/selection';
import focusEditableElement from '../../../../util/focusEditableElement';
import twemojiRegex from '../../../../lib/twemojiRegex';
import { buildCustomEmojiHtml } from '../helpers/customEmoji';

import useOnSelectionChange from '../../../../hooks/useOnSelectionChange';
import useCacheBuster from '../../../../hooks/useCacheBuster';

const RE_ENDS_ON_EMOJI = new RegExp(`(${twemojiRegex.source})$`, 'g');
const ENDS_ON_EMOJI_IMG_REGEX = new RegExp(`${EMOJI_IMG_REGEX.source}$`, 'g');

export default function useCustomEmojiTooltip(
  isAllowed: boolean,
  inputSelector: string,
  html: string,
  onUpdateHtml: (html: string) => void,
  stickers?: ApiSticker[],
  isDisabled = false,
) {
  const { loadCustomEmojiForEmoji, clearCustomEmojiForEmoji } = getActions();

  const [htmlBeforeSelection, setHtmlBeforeSelection] = useState('');

  const [cacheBuster, updateCacheBuster] = useCacheBuster();

  const handleSelectionChange = useCallback((range: Range) => {
    if (range.collapsed) {
      updateCacheBuster(); // Update tooltip on cursor move
    }
  }, [updateCacheBuster]);

  useOnSelectionChange(inputSelector, handleSelectionChange);

  useEffect(() => {
    if (!html) {
      setHtmlBeforeSelection('');
      return;
    }
    setHtmlBeforeSelection(getHtmlBeforeSelection(document.querySelector<HTMLDivElement>(inputSelector)!));
  }, [html, inputSelector, cacheBuster]);

  const lastEmojiText = htmlBeforeSelection.match(IS_EMOJI_SUPPORTED ? RE_ENDS_ON_EMOJI : ENDS_ON_EMOJI_IMG_REGEX)?.[0];
  const hasStickers = Boolean(stickers?.length && lastEmojiText);

  useEffect(() => {
    if (isDisabled) return;

    if (isAllowed && lastEmojiText) {
      loadCustomEmojiForEmoji({
        emoji: IS_EMOJI_SUPPORTED ? lastEmojiText : lastEmojiText.match(/.+alt="(.+)"/)?.[1]!,
      });
    } else if (hasStickers || !lastEmojiText) {
      clearCustomEmojiForEmoji();
    }
    // We omit `hasStickers` here to prevent re-fetching after manually closing tooltip (via <Esc>).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEmojiText, clearCustomEmojiForEmoji, loadCustomEmojiForEmoji, isAllowed, isDisabled]);

  const insertCustomEmoji = useCallback((emoji: ApiSticker) => {
    if (!lastEmojiText) return;
    const containerEl = document.querySelector<HTMLDivElement>(inputSelector)!;
    const regexText = IS_EMOJI_SUPPORTED ? lastEmojiText
      // Escape regexp special chars
      : lastEmojiText.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${regexText})\\1*$`, '');
    const matched = htmlBeforeSelection.match(regex)![0];
    const count = matched.length / lastEmojiText.length;

    const newHtml = htmlBeforeSelection.replace(regex, buildCustomEmojiHtml(emoji).repeat(count));
    const htmlAfterSelection = containerEl.innerHTML.substring(htmlBeforeSelection.length);
    onUpdateHtml(`${newHtml}${htmlAfterSelection}`);

    requestAnimationFrame(() => {
      focusEditableElement(containerEl, true, true);
    });
  }, [htmlBeforeSelection, inputSelector, lastEmojiText, onUpdateHtml]);

  return {
    isCustomEmojiTooltipOpen: hasStickers,
    closeCustomEmojiTooltip: clearCustomEmojiForEmoji,
    insertCustomEmoji,
  };
}
