import { useEffect, useMemo } from '../../../../lib/teact/teact';
import { getDispatch } from '../../../../lib/teact/teactn';

import { ApiSticker } from '../../../../api/types';

import { IS_EMOJI_SUPPORTED } from '../../../../util/environment';

import parseEmojiOnlyString from '../../../common/helpers/parseEmojiOnlyString';
import { prepareForRegExp } from '../helpers/prepareForRegExp';

export default function useStickerTooltip(
  isAllowed: boolean,
  html: string,
  stickers?: ApiSticker[],
  isDisabled = false,
) {
  const cleanHtml = useMemo(() => prepareForRegExp(html).trim(), [html]);
  const { loadStickersForEmoji, clearStickersForEmoji } = getDispatch();
  const isSingleEmoji = (
    (IS_EMOJI_SUPPORTED && parseEmojiOnlyString(cleanHtml) === 1)
    || (!IS_EMOJI_SUPPORTED && Boolean(html.match(/^<img.[^>]*?>$/g)))
  );
  const hasStickers = Boolean(stickers) && isSingleEmoji;

  useEffect(() => {
    if (isDisabled) return;

    if (isAllowed && isSingleEmoji) {
      loadStickersForEmoji({ emoji: cleanHtml });
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
