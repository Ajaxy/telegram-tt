import { useEffect, useMemo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiSticker } from '../../../../api/types';

import { EMOJI_IMG_REGEX } from '../../../../config';
import { IS_EMOJI_SUPPORTED } from '../../../../util/environment';
import parseEmojiOnlyString from '../../../common/helpers/parseEmojiOnlyString';
import { prepareForRegExp } from '../helpers/prepareForRegExp';

const STARTS_ENDS_ON_EMOJI_IMG_REGEX = new RegExp(`^${EMOJI_IMG_REGEX.source}$`, 'g');

export default function useStickerTooltip(
  isAllowed: boolean,
  html: string,
  stickers?: ApiSticker[],
  isDisabled = false,
) {
  const cleanHtml = useMemo(() => prepareForRegExp(html).trim(), [html]);
  const { loadStickersForEmoji, clearStickersForEmoji } = getActions();
  const isSingleEmoji = (
    (IS_EMOJI_SUPPORTED && parseEmojiOnlyString(cleanHtml) === 1)
    || (!IS_EMOJI_SUPPORTED && Boolean(html.match(STARTS_ENDS_ON_EMOJI_IMG_REGEX)))
  );
  const hasStickers = Boolean(stickers?.length) && isSingleEmoji;

  useEffect(() => {
    if (isDisabled) return;

    if (isAllowed && isSingleEmoji) {
      loadStickersForEmoji({
        emoji: IS_EMOJI_SUPPORTED ? cleanHtml : cleanHtml.match(/alt="(.+)"/)?.[1]!,
      });
    } else if (hasStickers || !isSingleEmoji) {
      clearStickersForEmoji();
    }
    // We omit `hasStickers` here to prevent re-fetching after manually closing tooltip (via <Esc>).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, isSingleEmoji, clearStickersForEmoji, loadStickersForEmoji, isAllowed, isDisabled]);

  return {
    isStickerTooltipOpen: hasStickers,
    closeStickerTooltip: clearStickersForEmoji,
  };
}
