import React, { memo } from '../../../lib/teact/teact';

import type { FC } from '../../../lib/teact/teact';
import type { ApiAvailableReaction, ApiReaction } from '../../../api/types';

import { createClassNameBuilder } from '../../../util/buildClassName';
import useMedia from '../../../hooks/useMedia';
import useFlag from '../../../hooks/useFlag';

import AnimatedSticker from '../../common/AnimatedSticker';

import './ReactionSelectorReaction.scss';

const REACTION_SIZE = 32;

type OwnProps = {
  reaction: ApiAvailableReaction;
  isReady?: boolean;
  chosen?: boolean;
  onToggleReaction: (reaction: ApiReaction) => void;
};

const cn = createClassNameBuilder('ReactionSelectorReaction');

const ReactionSelectorReaction: FC<OwnProps> = ({
  reaction,
  isReady,
  chosen,
  onToggleReaction,
}) => {
  const mediaAppearData = useMedia(`sticker${reaction.appearAnimation?.id}`, !isReady);
  const mediaData = useMedia(`document${reaction.selectAnimation?.id}`, !isReady);
  const [isAnimationLoaded, markAnimationLoaded] = useFlag();

  const [isFirstPlay, , unmarkIsFirstPlay] = useFlag(true);
  const [isActivated, activate, deactivate] = useFlag();

  function handleClick() {
    onToggleReaction(reaction.reaction);
  }

  return (
    <div
      className={cn('&', chosen && 'chosen')}
      onClick={handleClick}
      onMouseEnter={isReady && !isFirstPlay ? activate : undefined}
    >
      {!isAnimationLoaded && (
        <AnimatedSticker
          key={reaction.appearAnimation?.id}
          tgsUrl={mediaAppearData}
          play={isFirstPlay}
          noLoop
          size={REACTION_SIZE}
          onEnded={unmarkIsFirstPlay}
        />
      )}
      {!isFirstPlay && (
        <AnimatedSticker
          key={reaction.selectAnimation?.id}
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
