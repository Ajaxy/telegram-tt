import { useEffect } from '../../../../lib/teact/teact';

import type { ApiSticker } from '../../../../api/types';
import type { Signal } from '../../../../util/signals';

import { getActions } from '../../../../global';
import { EMOJI_IMG_REGEX } from '../../../../config';
import { IS_EMOJI_SUPPORTED } from '../../../../util/environment';
import parseEmojiOnlyString from '../../../../util/parseEmojiOnlyString';
import twemojiRegex from '../../../../lib/twemojiRegex';
import { prepareForRegExp } from '../helpers/prepareForRegExp';

import useDerivedState from '../../../../hooks/useDerivedState';
import useFlag from '../../../../hooks/useFlag';
import useDerivedSignal from '../../../../hooks/useDerivedSignal';

const MAX_LENGTH = 8;
const STARTS_ENDS_ON_EMOJI_IMG_REGEX = new RegExp(`^${EMOJI_IMG_REGEX.source}$`, 'g');

export default function useStickerTooltip(
  isEnabled: boolean,
  getHtml: Signal<string>,
  stickers?: ApiSticker[],
) {
  const { loadStickersForEmoji, clearStickersForEmoji } = getActions();

  const [isManuallyClosed, markManuallyClosed, unmarkManuallyClosed] = useFlag(false);

  const getSingleEmoji = useDerivedSignal(() => {
    const html = getHtml();
    if (!isEnabled || !html || (IS_EMOJI_SUPPORTED && html.length > MAX_LENGTH)) return undefined;

    const hasEmoji = html.match(IS_EMOJI_SUPPORTED ? twemojiRegex : EMOJI_IMG_REGEX);
    if (!hasEmoji) return undefined;

    const cleanHtml = prepareForRegExp(html);
    const isSingleEmoji = cleanHtml && (
      (IS_EMOJI_SUPPORTED && parseEmojiOnlyString(cleanHtml) === 1)
      || (!IS_EMOJI_SUPPORTED && Boolean(html.match(STARTS_ENDS_ON_EMOJI_IMG_REGEX)))
    );

    return isSingleEmoji
      ? (IS_EMOJI_SUPPORTED ? cleanHtml : cleanHtml.match(/alt="(.+)"/)?.[1]!)
      : undefined;
  }, [getHtml, isEnabled]);

  const isActive = useDerivedState(() => Boolean(getSingleEmoji()), [getSingleEmoji]);
  const hasStickers = Boolean(stickers?.length);

  useEffect(() => {
    if (!isEnabled) return;

    const singleEmoji = getSingleEmoji();
    if (singleEmoji) {
      if (!hasStickers) {
        loadStickersForEmoji({ emoji: singleEmoji });
      }
    } else {
      clearStickersForEmoji();
    }
  }, [isEnabled, getSingleEmoji, hasStickers, loadStickersForEmoji, clearStickersForEmoji]);

  useEffect(unmarkManuallyClosed, [unmarkManuallyClosed, getHtml]);

  return {
    isStickerTooltipOpen: Boolean(isActive && hasStickers && !isManuallyClosed),
    closeStickerTooltip: markManuallyClosed,
  };
}
