import React, {
  memo, useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';

import type { ApiSticker } from '../../../api/types';
import type { FC } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';
import findInViewport from '../../../util/findInViewport';
import isFullyVisible from '../../../util/isFullyVisible';
import fastSmoothScrollHorizontal from '../../../util/fastSmoothScrollHorizontal';

import useShowTransition from '../../../hooks/useShowTransition';
import usePrevDuringAnimation from '../../../hooks/usePrevDuringAnimation';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import useHorizontalScroll from '../../../hooks/useHorizontalScroll';

import Loading from '../../ui/Loading';
import EmojiButton from './EmojiButton';
import CustomEmojiButton from './CustomEmojiButton';

import './EmojiTooltip.scss';

const VIEWPORT_MARGIN = 8;
const EMOJI_BUTTON_WIDTH = 44;
const CLOSE_DURATION = 350;

function setItemVisible(index: number, containerRef: Record<string, any>) {
  const container = containerRef.current!;
  if (!container) {
    return;
  }

  const { visibleIndexes, allElements } = findInViewport(
    container,
    '.EmojiButton',
    VIEWPORT_MARGIN,
    true,
    true,
    true,
  );

  if (!allElements.length || !allElements[index]) {
    return;
  }
  const first = visibleIndexes[0];
  if (!visibleIndexes.includes(index)
    || (index === first && !isFullyVisible(container, allElements[first], true))) {
    const position = index > visibleIndexes[visibleIndexes.length - 1] ? 'start' : 'end';
    const newLeft = position === 'start' ? index * EMOJI_BUTTON_WIDTH : 0;

    fastSmoothScrollHorizontal(container, newLeft);
  }
}

export type OwnProps = {
  isOpen: boolean;
  emojis: Emoji[];
  customEmojis: ApiSticker[];
  onEmojiSelect: (text: string) => void;
  onCustomEmojiSelect: (emoji: ApiSticker) => void;
  onClose: NoneToVoidFunction;
  addRecentEmoji: ({ emoji }: { emoji: string }) => void;
  addRecentCustomEmoji: ({ documentId }: { documentId: string }) => void;
};

const EmojiTooltip: FC<OwnProps> = ({
  isOpen,
  emojis,
  customEmojis,
  onClose,
  onEmojiSelect,
  onCustomEmojiSelect,
  addRecentEmoji,
  addRecentCustomEmoji,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldRender, transitionClassNames } = useShowTransition(isOpen, undefined, undefined, false);
  const listEmojis: (Emoji | ApiSticker)[] = usePrevDuringAnimation(
    emojis.length ? [...customEmojis, ...emojis] : undefined, CLOSE_DURATION,
  ) || [];

  useHorizontalScroll(containerRef.current);

  const handleSelectEmoji = useCallback((emoji: Emoji) => {
    onEmojiSelect(emoji.native);
    addRecentEmoji({ emoji: emoji.id });
  }, [addRecentEmoji, onEmojiSelect]);

  const handleCustomEmojiSelect = useCallback((emoji: ApiSticker) => {
    onCustomEmojiSelect(emoji);
    addRecentCustomEmoji({ documentId: emoji.id });
  }, [addRecentCustomEmoji, onCustomEmojiSelect]);

  const handleSelect = useCallback((emoji: Emoji | ApiSticker) => {
    if ('native' in emoji) {
      handleSelectEmoji(emoji);
    } else {
      handleCustomEmojiSelect(emoji);
    }
  }, [handleCustomEmojiSelect, handleSelectEmoji]);

  const handleClick = useCallback((native: string, id: string) => {
    onEmojiSelect(native);
    addRecentEmoji({ emoji: id });
  }, [addRecentEmoji, onEmojiSelect]);

  const handleCustomEmojiClick = useCallback((emoji: ApiSticker) => {
    onCustomEmojiSelect(emoji);
    addRecentCustomEmoji({ documentId: emoji.id });
  }, [addRecentCustomEmoji, onCustomEmojiSelect]);

  const selectedIndex = useKeyboardNavigation({
    isActive: isOpen,
    isHorizontal: true,
    items: listEmojis,
    onSelect: handleSelect,
    onClose,
  });

  useEffect(() => {
    setItemVisible(selectedIndex, containerRef);
  }, [selectedIndex]);

  const className = buildClassName(
    'EmojiTooltip composer-tooltip custom-scroll-x',
    transitionClassNames,
  );

  return (
    <div
      ref={containerRef}
      className={className}
    >
      {shouldRender && listEmojis ? (
        listEmojis.map((emoji, index) => (
          'native' in emoji ? (
            <EmojiButton
              key={emoji.id}
              emoji={emoji}
              focus={selectedIndex === index}
              onClick={handleClick}
            />
          ) : (
            <CustomEmojiButton
              key={emoji.id}
              emoji={emoji}
              focus={selectedIndex === index}
              onClick={handleCustomEmojiClick}
            />
          )
        ))
      ) : shouldRender ? (
        <Loading />
      ) : undefined}
    </div>
  );
};

export default memo(EmojiTooltip);
