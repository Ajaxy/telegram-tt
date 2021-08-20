import React, {
  FC, memo, useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';

import { IS_TOUCH_ENV } from '../../../util/environment';
import buildClassName from '../../../util/buildClassName';
import findInViewport from '../../../util/findInViewport';
import isFullyVisible from '../../../util/isFullyVisible';
import fastSmoothScrollHorizontal from '../../../util/fastSmoothScrollHorizontal';
import useShowTransition from '../../../hooks/useShowTransition';
import usePrevDuringAnimation from '../../../hooks/usePrevDuringAnimation';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';

import Loading from '../../ui/Loading';
import EmojiButton from './EmojiButton';

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
  onEmojiSelect: (text: string) => void;
  onClose: NoneToVoidFunction;
  addRecentEmoji: AnyToVoidFunction;
  emojis: Emoji[];
};

const EmojiTooltip: FC<OwnProps> = ({
  isOpen,
  emojis,
  onClose,
  onEmojiSelect,
  addRecentEmoji,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldRender, transitionClassNames } = useShowTransition(isOpen, undefined, undefined, false);
  const listEmojis: Emoji[] = usePrevDuringAnimation(emojis.length ? emojis : undefined, CLOSE_DURATION) || [];

  const handleSelectEmoji = useCallback((emoji: Emoji) => {
    onEmojiSelect(emoji.native);
    addRecentEmoji({ emoji: emoji.id });
  }, [addRecentEmoji, onEmojiSelect]);

  const handleClick = useCallback((native: string, id: string) => {
    onEmojiSelect(native);
    addRecentEmoji({ emoji: id });
  }, [addRecentEmoji, onEmojiSelect]);

  const selectedIndex = useKeyboardNavigation({
    isActive: isOpen,
    isHorizontal: true,
    items: emojis,
    onSelect: handleSelectEmoji,
    onClose,
  });

  useEffect(() => {
    setItemVisible(selectedIndex, containerRef);
  }, [selectedIndex]);

  const handleMouseEnter = () => {
    document.body.classList.add('no-select');
  };

  const handleMouseLeave = () => {
    document.body.classList.remove('no-select');
  };

  const className = buildClassName(
    'EmojiTooltip composer-tooltip custom-scroll-x',
    transitionClassNames,
  );

  return (
    <div
      ref={containerRef}
      className={className}
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
    >
      {shouldRender && listEmojis ? (
        listEmojis.map((emoji, index) => (
          <EmojiButton
            key={emoji.id}
            emoji={emoji}
            focus={selectedIndex === index}
            onClick={handleClick}
          />
        ))
      ) : shouldRender ? (
        <Loading />
      ) : undefined}
    </div>
  );
};

export default memo(EmojiTooltip);
