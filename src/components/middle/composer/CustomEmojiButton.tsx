import React, { memo, useCallback } from '../../../lib/teact/teact';

import type { FC } from '../../../lib/teact/teact';
import type { ApiSticker } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';

import CustomEmoji from '../../common/CustomEmoji';

import './EmojiButton.scss';

const CUSTOM_EMOJI_SIZE = 32;

type OwnProps = {
  emoji: ApiSticker;
  focus?: boolean;
  onClick?: (emoji: ApiSticker) => void;
};

const CustomEmojiButton: FC<OwnProps> = ({
  emoji, focus, onClick,
}) => {
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    // Preventing safari from losing focus on Composer MessageInput
    e.preventDefault();

    onClick?.(emoji);
  }, [emoji, onClick]);

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
      <CustomEmoji documentId={emoji.id} size={CUSTOM_EMOJI_SIZE} shouldPreloadPreview />
    </div>
  );
};

export default memo(CustomEmojiButton);
