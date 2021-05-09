import React, { FC, memo, useCallback } from '../../../lib/teact/teact';

import { IS_EMOJI_SUPPORTED } from '../../../util/environment';

import './EmojiButton.scss';

type OwnProps = {
  emoji: Emoji;
  onClick: (emoji: string, name: string) => void;
};

const EmojiButton: FC<OwnProps> = ({ emoji, onClick }) => {
  const handleClick = useCallback(() => {
    onClick(emoji.native, emoji.id);
  }, [emoji, onClick]);

  return (
    <div
      className="EmojiButton"
      onClick={handleClick}
      title={emoji.colons}
    >
      {IS_EMOJI_SUPPORTED ? emoji.native : <img src={`/img-apple-64/${emoji.image}.png`} alt="" loading="lazy" />}
    </div>
  );
};

export default memo(EmojiButton);
