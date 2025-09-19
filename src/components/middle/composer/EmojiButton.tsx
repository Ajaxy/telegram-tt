import type { FC } from '../../../lib/teact/teact';
import type React from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';

import { IS_EMOJI_SUPPORTED } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { handleEmojiLoad, LOADED_EMOJIS } from '../../../util/emoji/emoji';

import useLastCallback from '../../../hooks/useLastCallback';

import './EmojiButton.scss';

type OwnProps = {
  emoji: Emoji;
  focus?: boolean;
  onClick: (emoji: string, name: string) => void;
};

const EmojiButton: FC<OwnProps> = ({
  emoji, focus, onClick,
}) => {
  const handleClick = useLastCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    // Preventing safari from losing focus on Composer MessageInput
    e.preventDefault();

    onClick(emoji.native, emoji.id);
  });

  const className = buildClassName(
    'EmojiButton',
    focus && 'focus',
  );

  const src = `./img-apple-64/${emoji.image}.png`;
  const isLoaded = LOADED_EMOJIS.has(src);

  return (
    <div
      className={className}
      onMouseDown={handleClick}
      title={`:${emoji.names[0]}:`}
    >
      {IS_EMOJI_SUPPORTED ? emoji.native : (
        <img
          src={src}
          className={!isLoaded ? 'opacity-transition shown' : undefined}
          alt={emoji.native}
          loading="lazy"
          data-path={src}
          onLoad={!isLoaded ? handleEmojiLoad : undefined}
          draggable={false}
        />
      )}
    </div>
  );
};

export default memo(EmojiButton);
