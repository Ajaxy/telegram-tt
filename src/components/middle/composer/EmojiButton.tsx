import React, { FC, memo, useCallback } from '../../../lib/teact/teact';

import { IS_EMOJI_SUPPORTED } from '../../../util/environment';

import './EmojiButton.scss';

type OwnProps = {
  emoji: Emoji;
  focus?: boolean;
  onClick: (emoji: string, name: string) => void;
};

const EmojiButton: FC<OwnProps> = ({ emoji, focus, onClick }) => {
  const handleClick = useCallback(() => {
    onClick(emoji.native, emoji.id);
  }, [emoji, onClick]);

  return (
    <div
      className={`EmojiButton ${focus ? 'focus' : ''}`}
      onClick={handleClick}
      title={`:${emoji.names[0]}:`}
    >
      {IS_EMOJI_SUPPORTED
        ? <span className="font-emoji">{emoji.native}</span>
        : <img src={`/img-apple-64/${emoji.image}.png`} alt="" loading="lazy" />}
    </div>
  );
};

export default memo(EmojiButton);
