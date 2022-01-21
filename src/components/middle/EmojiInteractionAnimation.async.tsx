import React, { FC, memo } from '../../lib/teact/teact';
import { OwnProps } from './EmojiInteractionAnimation';
import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const EmojiInteractionAnimationAsync: FC<OwnProps> = (props) => {
  const { emojiInteraction } = props;
  const EmojiInteractionAnimation = useModuleLoader(Bundles.Extra, 'EmojiInteractionAnimation', !emojiInteraction);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return EmojiInteractionAnimation ? <EmojiInteractionAnimation {...props} /> : undefined;
};

export default memo(EmojiInteractionAnimationAsync);
