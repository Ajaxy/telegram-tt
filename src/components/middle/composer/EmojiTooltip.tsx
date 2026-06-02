import type { FC } from '../../../lib/teact/teact';
import { memo, useRef } from '../../../lib/teact/teact';

import type { ApiSticker } from '../../../api/types';

import animateHorizontalScroll from '../../../util/animateHorizontalScroll';
import buildClassName from '../../../util/buildClassName';
import findInViewport from '../../../util/findInViewport';
import isFullyVisible from '../../../util/visibility/isFullyVisible';

import useEffectWithPrevDeps from '../../../hooks/useEffectWithPrevDeps';
import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import usePrevDuringAnimation from '../../../hooks/usePrevDuringAnimation';
import useShowTransitionDeprecated from '../../../hooks/useShowTransitionDeprecated';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';

import Loading from '../../ui/Loading';
import CustomEmojiButton from './CustomEmojiButton';
import EmojiButton from './EmojiButton';

import './EmojiTooltip.scss';

const VIEWPORT_MARGIN = 8;
const EMOJI_BUTTON_WIDTH = 44;
const CLOSE_DURATION = 350;

function setItemVisible(index: number, prevIndex: number | undefined, containerRef: Record<string, any>) {
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

  if (!allElements.length || !allElements[index] || !visibleIndexes.length) {
    return;
  }

  if (prevIndex === undefined || prevIndex === -1 || Math.abs(index - prevIndex) !== 1) {
    const first = visibleIndexes[0];
    if (!visibleIndexes.includes(index)
      || (index === first && !isFullyVisible(container, allElements[first], true))) {
      const position = index > visibleIndexes[visibleIndexes.length - 1] ? 'start' : 'end';
      const newLeft = position === 'start' ? index * EMOJI_BUTTON_WIDTH : 0;
      animateHorizontalScroll(container, newLeft);
    }
    return;
  }

  const middlePosition = Math.floor(visibleIndexes.length / 2);
  const middleIndex = visibleIndexes[middlePosition];
  const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);

  if (index > prevIndex) {
    if (index >= middleIndex + 1) {
      const newLeft = Math.min(maxScrollLeft, container.scrollLeft + EMOJI_BUTTON_WIDTH);
      animateHorizontalScroll(container, newLeft);
    }
    return;
  }

  if (index <= middleIndex - 1) {
    const newLeft = Math.max(0, container.scrollLeft - EMOJI_BUTTON_WIDTH);
    animateHorizontalScroll(container, newLeft);
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

const INTERSECTION_THROTTLE = 200;

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
  const containerRef = useRef<HTMLDivElement>();
  const { shouldRender, transitionClassNames } = useShowTransitionDeprecated(isOpen, undefined, undefined, false);
  const listEmojis: (Emoji | ApiSticker)[] = usePrevDuringAnimation(
    emojis.length ? [...emojis, ...customEmojis] : undefined, CLOSE_DURATION,
  ) || [];

  useHorizontalScroll(containerRef);

  const {
    observe: observeIntersection,
  } = useIntersectionObserver({ rootRef: containerRef, throttleMs: INTERSECTION_THROTTLE, isDisabled: !isOpen });

  const handleSelectEmoji = useLastCallback((emoji: Emoji) => {
    onEmojiSelect(emoji.native);
    addRecentEmoji({ emoji: emoji.id });
  });

  const handleCustomEmojiSelect = useLastCallback((emoji: ApiSticker) => {
    onCustomEmojiSelect(emoji);
    addRecentCustomEmoji({ documentId: emoji.id });
  });

  const handleSelect = useLastCallback((emoji: Emoji | ApiSticker) => {
    if ('native' in emoji) {
      handleSelectEmoji(emoji);
    } else {
      handleCustomEmojiSelect(emoji);
    }
  });

  const handleClick = useLastCallback((native: string, id: string) => {
    onEmojiSelect(native);
    addRecentEmoji({ emoji: id });
  });

  const handleCustomEmojiClick = useLastCallback((emoji: ApiSticker) => {
    onCustomEmojiSelect(emoji);
    addRecentCustomEmoji({ documentId: emoji.id });
  });

  const selectedIndex = useKeyboardNavigation({
    isActive: isOpen,
    isHorizontal: true,
    items: listEmojis,
    shouldRemoveSelectionOnReset: true,
    onSelect: handleSelect,
    onClose,
  });

  useEffectWithPrevDeps(([prevSelectedIndex]) => {
    if (prevSelectedIndex === undefined) {
      return;
    }

    setItemVisible(selectedIndex, prevSelectedIndex, containerRef);
  }, [selectedIndex]);

  const className = buildClassName(
    'EmojiTooltip composer-tooltip no-scrollbar',
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
              observeIntersection={observeIntersection}
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
