import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import type { OwnProps } from './EmojiInteractionAnimation';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const EmojiInteractionAnimationAsync: FC<OwnProps> = (props) => {
  const { activeEmojiInteraction } = props;
  const EmojiInteractionAnimation = useModuleLoader(
    Bundles.Extra, 'EmojiInteractionAnimation', !activeEmojiInteraction,
  );

  // eslint-disable-next-line react/jsx-props-no-spreading
  return EmojiInteractionAnimation ? <EmojiInteractionAnimation {...props} /> : undefined;
};

export default EmojiInteractionAnimationAsync;
