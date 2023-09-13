import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';

import type { ApiSticker } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';

import buildClassName from '../../../util/buildClassName';

import useLastCallback from '../../../hooks/useLastCallback';

import CustomEmoji from '../../common/CustomEmoji';

import './EmojiButton.scss';

const CUSTOM_EMOJI_SIZE = 32;

type OwnProps = {
  emoji: ApiSticker;
  focus?: boolean;
  onClick?: (emoji: ApiSticker) => void;
  observeIntersection?: ObserveFn;
};

const CustomEmojiButton: FC<OwnProps> = ({
  emoji, focus, onClick, observeIntersection,
}) => {
  const handleClick = useLastCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    // Preventing safari from losing focus on Composer MessageInput
    e.preventDefault();

    onClick?.(emoji);
  });

  const className = buildClassName(
    'EmojiButton',
    focus && 'focus',
  );

  return (
    <div
      className={className}
      onMouseDown={handleClick}
      title={emoji.emoji}
    >
      <CustomEmoji
        documentId={emoji.id}
        size={CUSTOM_EMOJI_SIZE}
        withSharedAnimation
        shouldPreloadPreview
        observeIntersectionForPlaying={observeIntersection}
      />
    </div>
  );
};

export default memo(CustomEmojiButton);
