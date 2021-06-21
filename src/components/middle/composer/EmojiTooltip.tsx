import React, {
  FC, memo, useCallback, useEffect, useRef, useState,
} from '../../../lib/teact/teact';

import { LangCode } from '../../../types';

import { IS_TOUCH_ENV } from '../../../util/environment';
import buildClassName from '../../../util/buildClassName';
import cycleRestrict from '../../../util/cycleRestrict';
import captureKeyboardListeners from '../../../util/captureKeyboardListeners';
import findInViewport from '../../../util/findInViewport';
import isFullyVisible from '../../../util/isFullyVisible';
import fastSmoothScrollHorizontal from '../../../util/fastSmoothScrollHorizontal';
import useShowTransition from '../../../hooks/useShowTransition';
import usePrevDuringAnimation from '../../../hooks/usePrevDuringAnimation';

import Loading from '../../ui/Loading';
import EmojiButton from './EmojiButton';

import './EmojiTooltip.scss';

const VIEWPORT_MARGIN = 8;
const EMOJI_BUTTON_WIDTH = 44;
const CLOSE_DURATION = 350;
const NO_EMOJI_SELECTED_INDEX = -1;

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
  language: LangCode;
  onEmojiSelect: (text: string) => void;
  onClose: NoneToVoidFunction;
  addRecentEmoji: AnyToVoidFunction;
  loadEmojiKeywords: AnyToVoidFunction;
  emojis: Emoji[];
};

const EmojiTooltip: FC<OwnProps> = ({
  isOpen,
  language,
  emojis,
  onClose,
  onEmojiSelect,
  addRecentEmoji,
  loadEmojiKeywords,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldRender, transitionClassNames } = useShowTransition(isOpen, undefined, undefined, false);
  const listEmojis: Emoji[] = usePrevDuringAnimation(emojis.length ? emojis : undefined, CLOSE_DURATION) || [];

  const [selectedIndex, setSelectedIndex] = useState(NO_EMOJI_SELECTED_INDEX);

  useEffect(() => {
    loadEmojiKeywords({ language: 'en' });
    if (language !== 'en') {
      loadEmojiKeywords({ language });
    }
  }, [loadEmojiKeywords, language]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [emojis]);

  useEffect(() => {
    setItemVisible(selectedIndex, containerRef);
  }, [selectedIndex]);

  const getSelectedIndex = useCallback((newIndex: number) => {
    if (!emojis.length) {
      return NO_EMOJI_SELECTED_INDEX;
    }

    const emojisCount = emojis.length;
    return cycleRestrict(emojisCount, newIndex);
  }, [emojis]);

  const handleArrowKey = useCallback((value: number, e: KeyboardEvent) => {
    e.preventDefault();
    setSelectedIndex((index) => (getSelectedIndex(index + value)));
  }, [setSelectedIndex, getSelectedIndex]);

  const handleSelectEmoji = useCallback((e: KeyboardEvent) => {
    if (emojis.length && selectedIndex > NO_EMOJI_SELECTED_INDEX) {
      const emoji = emojis[selectedIndex];
      if (emoji) {
        e.preventDefault();
        onEmojiSelect(emoji.native);
        addRecentEmoji({ emoji: emoji.id });
      }
    }
  }, [addRecentEmoji, emojis, onEmojiSelect, selectedIndex]);

  useEffect(() => (isOpen ? captureKeyboardListeners({
    onEsc: onClose,
    onLeft: (e: KeyboardEvent) => handleArrowKey(-1, e),
    onRight: (e: KeyboardEvent) => handleArrowKey(1, e),
    onEnter: handleSelectEmoji,
  }) : undefined), [handleArrowKey, handleSelectEmoji, isOpen, onClose]);

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
            onClick={onEmojiSelect}
          />
        ))
      ) : shouldRender ? (
        <Loading />
      ) : undefined}
    </div>
  );
};

export default memo(EmojiTooltip);
