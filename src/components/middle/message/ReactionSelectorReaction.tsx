import React, { memo } from '../../../lib/teact/teact';

import type { FC } from '../../../lib/teact/teact';
import type { ApiAvailableReaction, ApiReaction } from '../../../api/types';

import { IS_COMPACT_MENU } from '../../../util/environment';
import { createClassNameBuilder } from '../../../util/buildClassName';
import useMedia from '../../../hooks/useMedia';
import useFlag from '../../../hooks/useFlag';

import AnimatedSticker from '../../common/AnimatedSticker';

import './ReactionSelectorReaction.scss';

const REACTION_SIZE = IS_COMPACT_MENU ? 24 : 32;

type OwnProps = {
  reaction: ApiAvailableReaction;
  previewIndex: number;
  isReady?: boolean;
  chosen?: boolean;
  onToggleReaction: (reaction: ApiReaction) => void;
};

const cn = createClassNameBuilder('ReactionSelectorReaction');

const ReactionSelectorReaction: FC<OwnProps> = ({
  reaction,
  previewIndex,
  isReady,
  chosen,
  onToggleReaction,
}) => {
  const mediaData = useMedia(`document${reaction.selectAnimation?.id}`, !isReady);

  const [isActivated, activate, deactivate] = useFlag();
  const [isAnimationLoaded, markAnimationLoaded] = useFlag();

  const shouldRenderStatic = !isReady || !isAnimationLoaded;
  const shouldRenderAnimated = Boolean(isReady && mediaData);

  function handleClick() {
    onToggleReaction(reaction.reaction);
  }

  return (
    <div
      className={cn('&', IS_COMPACT_MENU && 'compact', chosen && 'chosen')}
      onClick={handleClick}
      onMouseEnter={isReady ? activate : undefined}
    >
      {shouldRenderStatic && (
        <div
          className={cn('static')}
          style={`background-position-x: ${previewIndex * -REACTION_SIZE}px;`}
        />
      )}
      {shouldRenderAnimated && (
        <AnimatedSticker
          tgsUrl={mediaData}
          play={isActivated}
          noLoop
          size={REACTION_SIZE}
          onLoad={markAnimationLoaded}
          onEnded={deactivate}
        />
      )}
    </div>
  );
};

export default memo(ReactionSelectorReaction);
