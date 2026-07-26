import { useEffect } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiSticker } from '../../../../api/types';
import type { GlobalState } from '../../../../global/types';
import type { RichEditor, RichEditorInsertContent } from '../richEditorTypes';

import { EMOJI_IMG_REGEX } from '../../../../config';
import twemojiRegex from '../../../../lib/twemojiRegex';
import { IS_EMOJI_SUPPORTED } from '../../../../util/browser/windowEnvironment';

import { useThrottledResolver } from '../../../../hooks/useAsyncResolvers';
import useDerivedSignal from '../../../../hooks/useDerivedSignal';
import useDerivedState from '../../../../hooks/useDerivedState';
import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';

const THROTTLE = 300;
const RE_ENDS_ON_EMOJI = new RegExp(`(${twemojiRegex.source})$`, 'g');
const RE_ENDS_ON_EMOJI_IMG = new RegExp(`${EMOJI_IMG_REGEX.source}$`, 'g');

export default function useCustomEmojiTooltip(
  isEnabled: boolean,
  richText: string,
  richEditor: RichEditor | undefined,
  customEmojiForEmoji: GlobalState['customEmojis']['forEmoji'],
) {
  const { loadCustomEmojiForEmoji, clearCustomEmojiForEmoji } = getActions();

  const [isManuallyClosed, markManuallyClosed, unmarkManuallyClosed] = useFlag(false);

  const extractLastEmojiThrottled = useThrottledResolver(() => {
    if (!isEnabled || !richText || !richEditor?.hasCollapsedSelection()) return undefined;

    const hasEmoji = richText.match(IS_EMOJI_SUPPORTED ? twemojiRegex : EMOJI_IMG_REGEX);
    if (!hasEmoji) return undefined;

    const textBeforeSelection = richEditor.getTextBeforeSelection();

    return textBeforeSelection.match(IS_EMOJI_SUPPORTED ? RE_ENDS_ON_EMOJI : RE_ENDS_ON_EMOJI_IMG)?.[0];
  }, [isEnabled, richEditor, richText], THROTTLE);

  const getLastEmoji = useDerivedSignal(
    extractLastEmojiThrottled, [extractLastEmojiThrottled, richText], true,
  );

  const lastEmojiMarkup = useDerivedState(getLastEmoji);
  const nativeEmoji = IS_EMOJI_SUPPORTED ? lastEmojiMarkup : lastEmojiMarkup?.match(/.+alt="(.+)"/)?.[1];
  const isActive = Boolean(nativeEmoji);
  const hasCustomEmojis = Boolean(
    nativeEmoji
    && customEmojiForEmoji.emoji === nativeEmoji
    && customEmojiForEmoji.stickers?.length,
  );

  useEffect(() => {
    if (!isEnabled) return;

    if (!nativeEmoji) {
      clearCustomEmojiForEmoji();
      return;
    }

    if (customEmojiForEmoji.emoji !== nativeEmoji) {
      loadCustomEmojiForEmoji({ emoji: nativeEmoji });
    }
  }, [
    isEnabled, nativeEmoji, customEmojiForEmoji.emoji, clearCustomEmojiForEmoji, loadCustomEmojiForEmoji,
  ]);

  const insertCustomEmoji = useLastCallback((customEmoji: ApiSticker) => {
    const activeEmoji = getLastEmoji();
    if (!isEnabled || !activeEmoji) return;

    const textBeforeSelection = richEditor?.getTextBeforeSelection() || '';
    const regexText = IS_EMOJI_SUPPORTED
      ? activeEmoji
      // Escape regexp special chars
      : activeEmoji.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${regexText})\\1*$`, '');
    const matched = textBeforeSelection.match(regex)?.[0];
    if (!matched) return;

    const count = matched.length / activeEmoji.length;
    const customEmojiContent: RichEditorInsertContent = { type: 'customEmoji', emoji: customEmoji };
    const customEmojiContentList = Array.from({ length: count }, () => customEmojiContent);
    richEditor?.replaceTextBeforeSelection(matched, customEmojiContentList);
  });

  useEffect(unmarkManuallyClosed, [unmarkManuallyClosed, richText]);

  return {
    isCustomEmojiTooltipOpen: Boolean(isActive && hasCustomEmojis && !isManuallyClosed),
    closeCustomEmojiTooltip: markManuallyClosed,
    insertCustomEmoji,
  };
}
