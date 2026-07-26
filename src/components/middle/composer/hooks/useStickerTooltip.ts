import { useEffect } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiSticker } from '../../../../api/types';

import { EMOJI_IMG_REGEX } from '../../../../config';
import twemojiRegex from '../../../../lib/twemojiRegex';
import { IS_EMOJI_SUPPORTED } from '../../../../util/browser/windowEnvironment';
import parseEmojiOnlyString from '../../../../util/emoji/parseEmojiOnlyString';
import { prepareForRegExp } from '../helpers/prepareForRegExp';

import useDerivedSignal from '../../../../hooks/useDerivedSignal';
import useDerivedState from '../../../../hooks/useDerivedState';
import useFlag from '../../../../hooks/useFlag';

const MAX_LENGTH = 8;
const STARTS_ENDS_ON_EMOJI_IMG_REGEX = new RegExp(`^${EMOJI_IMG_REGEX.source}$`, 'g');

export default function useStickerTooltip(
  isEnabled: boolean,
  richText: string,
  stickers?: ApiSticker[],
) {
  const { loadStickersForEmoji, clearStickersForEmoji } = getActions();

  const [isManuallyClosed, markManuallyClosed, unmarkManuallyClosed] = useFlag(false);

  const getSingleEmoji = useDerivedSignal(() => {
    if (!isEnabled || !richText || (IS_EMOJI_SUPPORTED && richText.length > MAX_LENGTH)) return undefined;

    const hasEmoji = richText.match(IS_EMOJI_SUPPORTED ? twemojiRegex : EMOJI_IMG_REGEX);
    if (!hasEmoji) return undefined;

    const cleanText = prepareForRegExp(richText);
    const isSingleEmoji = cleanText && (
      (IS_EMOJI_SUPPORTED && parseEmojiOnlyString(cleanText) === 1)
      || (!IS_EMOJI_SUPPORTED && Boolean(richText.match(STARTS_ENDS_ON_EMOJI_IMG_REGEX)))
    );

    return isSingleEmoji
      ? (IS_EMOJI_SUPPORTED ? cleanText : cleanText.match(/alt="(.+)"/)?.[1])
      : undefined;
  }, [richText, isEnabled]);

  const isActive = useDerivedState(() => Boolean(getSingleEmoji()), [getSingleEmoji]);
  const hasStickers = Boolean(stickers?.length);

  useEffect(() => {
    if (!isEnabled || !isActive) return;

    const singleEmoji = getSingleEmoji();
    if (singleEmoji) {
      if (!hasStickers) {
        loadStickersForEmoji({ emoji: singleEmoji });
      }
    } else {
      clearStickersForEmoji();
    }
  }, [isEnabled, isActive, getSingleEmoji, hasStickers, loadStickersForEmoji, clearStickersForEmoji]);

  useEffect(unmarkManuallyClosed, [unmarkManuallyClosed, richText]);

  return {
    isStickerTooltipOpen: Boolean(isActive && hasStickers && !isManuallyClosed),
    closeStickerTooltip: markManuallyClosed,
  };
}
