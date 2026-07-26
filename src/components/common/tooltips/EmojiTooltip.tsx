import { memo, useRef } from '../../../lib/teact/teact';

import type { ApiSticker } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';

import useFrozenProps from '../../../hooks/useFrozenProps';
import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';

import CustomEmojiButton from '../../middle/composer/CustomEmojiButton';
import EmojiButton from '../../middle/composer/EmojiButton';
import RichEditorTooltipPanel from './RichEditorTooltipPanel';

import styles from './EmojiTooltip.module.scss';
import sharedStyles from './RichEditorTooltip.module.scss';

export type OwnProps = {
  isOpen: boolean;
  selectedIndex: number;
  emojis: Emoji[];
  customEmojis: ApiSticker[];
  onEmojiSelect: (text: string) => void;
  onCustomEmojiSelect: (emoji: ApiSticker) => void;
};

const INTERSECTION_THROTTLE = 200;

const EmojiTooltip = ({ isOpen, ...props }: OwnProps) => {
  const {
    selectedIndex,
    emojis,
    customEmojis,
    onEmojiSelect,
    onCustomEmojiSelect,
  } = useFrozenProps(props, !isOpen);

  const containerRef = useRef<HTMLDivElement>();
  const listEmojis: (Emoji | ApiSticker)[] = [...emojis, ...customEmojis];
  const hasEmojis = Boolean(listEmojis.length);

  useHorizontalScroll(containerRef, !isOpen || !hasEmojis);

  const {
    observe: observeIntersection,
  } = useIntersectionObserver({ rootRef: containerRef, throttleMs: INTERSECTION_THROTTLE });

  if (!hasEmojis) {
    return undefined;
  }

  return (
    <RichEditorTooltipPanel isOpen={isOpen}>
      <div
        ref={containerRef}
        className={buildClassName(sharedStyles.root, styles.root, 'composer-tooltip no-scrollbar')}
      >
        {listEmojis.map((emoji, index) => (
          'native' in emoji ? (
            <EmojiButton
              key={emoji.id}
              emoji={emoji}
              focus={selectedIndex === index}
              onClick={onEmojiSelect}
            />
          ) : (
            <CustomEmojiButton
              key={emoji.id}
              emoji={emoji}
              focus={selectedIndex === index}
              onClick={onCustomEmojiSelect}
              observeIntersection={observeIntersection}
            />
          )
        ))}
      </div>
    </RichEditorTooltipPanel>
  );
};

export default memo(EmojiTooltip);
