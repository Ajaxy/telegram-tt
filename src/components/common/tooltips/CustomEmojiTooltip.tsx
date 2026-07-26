import { memo, useRef } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiSticker } from '../../../api/types';
import type { GlobalActions } from '../../../global';

import { COMPOSER_EMOJI_SIZE_PICKER } from '../../../config';
import buildClassName from '../../../util/buildClassName';

import useFrozenProps from '../../../hooks/useFrozenProps';
import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';

import StickerButton from '../StickerButton';
import RichEditorTooltipPanel from './RichEditorTooltipPanel';

import styles from './CustomEmojiTooltip.module.scss';
import sharedStyles from './RichEditorTooltip.module.scss';

export type OwnProps = {
  isOpen: boolean;
  customEmoji?: ApiSticker[];
  isSavedMessages?: boolean;
  isCurrentUserPremium?: boolean;
  noPlay?: boolean;
  addRecentCustomEmoji: GlobalActions['addRecentCustomEmoji'];
  onCustomEmojiSelect: (customEmoji: ApiSticker) => void;
};

const INTERSECTION_THROTTLE = 200;

const CustomEmojiTooltip = ({ isOpen, ...props }: OwnProps) => {
  const {
    addRecentCustomEmoji,
    onCustomEmojiSelect,
    customEmoji,
    isSavedMessages,
    isCurrentUserPremium,
    noPlay,
  } = useFrozenProps(props, !isOpen);

  const { clearCustomEmojiForEmoji } = getActions();

  const containerRef = useRef<HTMLDivElement>();
  const hasCustomEmoji = Boolean(customEmoji?.length);

  useHorizontalScroll(containerRef, !isOpen || !hasCustomEmoji);

  const {
    observe: observeIntersection,
  } = useIntersectionObserver({ rootRef: containerRef, throttleMs: INTERSECTION_THROTTLE });

  const handleCustomEmojiSelect = useLastCallback((ce: ApiSticker) => {
    onCustomEmojiSelect(ce);
    addRecentCustomEmoji({
      documentId: ce.id,
    });
    clearCustomEmojiForEmoji();
  });

  const className = buildClassName(
    sharedStyles.root,
    styles.root,
    'composer-tooltip no-scrollbar',
  );

  if (!hasCustomEmoji) {
    return undefined;
  }

  return (
    <RichEditorTooltipPanel isOpen={isOpen}>
      <div
        ref={containerRef}
        className={className}
      >
        {customEmoji.map((sticker) => (
          <StickerButton
            key={sticker.id}
            sticker={sticker}
            className={styles.emojiButton}
            size={COMPOSER_EMOJI_SIZE_PICKER}
            observeIntersection={observeIntersection}
            onClick={handleCustomEmojiSelect}
            clickArg={sticker}
            isSavedMessages={isSavedMessages}
            canViewSet
            isCurrentUserPremium={isCurrentUserPremium}
            noPlay={noPlay}
          />
        ))}
      </div>
    </RichEditorTooltipPanel>
  );
};

export default memo(CustomEmojiTooltip);
