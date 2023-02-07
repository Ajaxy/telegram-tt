import React, {
  memo, useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type { ApiSticker } from '../../../api/types';
import type { GlobalActions } from '../../../global/types';

import { COMPOSER_EMOJI_SIZE_PICKER } from '../../../config';
import { selectIsChatWithSelf, selectIsCurrentUserPremium } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';

import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useShowTransition from '../../../hooks/useShowTransition';
import usePrevious from '../../../hooks/usePrevious';
import useHorizontalScroll from '../../../hooks/useHorizontalScroll';

import Loading from '../../ui/Loading';
import StickerButton from '../../common/StickerButton';

import styles from './CustomEmojiTooltip.module.scss';

export type OwnProps = {
  chatId: string;
  isOpen: boolean;
  onCustomEmojiSelect: (customEmoji: ApiSticker) => void;
  addRecentCustomEmoji: GlobalActions['addRecentCustomEmoji'];
};

type StateProps = {
  customEmoji?: ApiSticker[];
  isSavedMessages?: boolean;
  isCurrentUserPremium?: boolean;
};

const INTERSECTION_THROTTLE = 200;

const CustomEmojiTooltip: FC<OwnProps & StateProps> = ({
  isOpen,
  customEmoji,
  isSavedMessages,
  isCurrentUserPremium,
  onCustomEmojiSelect,
  addRecentCustomEmoji,
}) => {
  const { clearCustomEmojiForEmoji } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldRender, transitionClassNames } = useShowTransition(isOpen, undefined, undefined, false);
  const prevStickers = usePrevious(customEmoji, true);
  const displayedStickers = customEmoji || prevStickers;

  useHorizontalScroll(containerRef);

  const {
    observe: observeIntersection,
  } = useIntersectionObserver({ rootRef: containerRef, throttleMs: INTERSECTION_THROTTLE });

  useEffect(() => (
    isOpen ? captureEscKeyListener(clearCustomEmojiForEmoji) : undefined
  ), [isOpen, clearCustomEmojiForEmoji]);

  const handleCustomEmojiSelect = useCallback((ce: ApiSticker) => {
    if (!isOpen) return;
    onCustomEmojiSelect(ce);
    addRecentCustomEmoji({
      documentId: ce.id,
    });
    clearCustomEmojiForEmoji();
  }, [addRecentCustomEmoji, clearCustomEmojiForEmoji, isOpen, onCustomEmojiSelect]);

  const className = buildClassName(
    styles.root,
    'composer-tooltip custom-scroll-x',
    transitionClassNames,
    !displayedStickers?.length && styles.hidden,
  );

  return (
    <div
      ref={containerRef}
      className={className}
    >
      {shouldRender && displayedStickers ? (
        displayedStickers.map((sticker) => (
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
          />
        ))
      ) : shouldRender ? (
        <Loading />
      ) : undefined}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const { stickers: customEmoji } = global.customEmojis.forEmoji;
    const isSavedMessages = selectIsChatWithSelf(global, chatId);
    const isCurrentUserPremium = selectIsCurrentUserPremium(global);
    return { customEmoji, isSavedMessages, isCurrentUserPremium };
  },
)(CustomEmojiTooltip));
