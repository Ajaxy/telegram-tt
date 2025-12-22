import type { OwnProps } from './EmojiInteractionAnimation';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const EmojiInteractionAnimationAsync = (props: OwnProps) => {
  const { activeEmojiInteraction } = props;
  const EmojiInteractionAnimation = useModuleLoader(
    Bundles.Extra, 'EmojiInteractionAnimation', !activeEmojiInteraction,
  );

  return EmojiInteractionAnimation ? <EmojiInteractionAnimation {...props} /> : undefined;
};

export default EmojiInteractionAnimationAsync;
