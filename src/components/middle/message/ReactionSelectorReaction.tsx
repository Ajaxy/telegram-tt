import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';

import type { ApiAvailableReaction, ApiReaction } from '../../../api/types';

import { createClassNameBuilder } from '../../../util/buildClassName';
import { REM } from '../../common/helpers/mediaDimensions';

import useFlag from '../../../hooks/useFlag';
import useMedia from '../../../hooks/useMedia';

import AnimatedSticker from '../../common/AnimatedSticker';

import './ReactionSelectorReaction.scss';

const REACTION_SIZE = 2 * REM;

type OwnProps = {
  reaction: ApiAvailableReaction;
  isReady?: boolean;
  chosen?: boolean;
  noAppearAnimation?: boolean;
  onToggleReaction: (reaction: ApiReaction) => void;
};

const cn = createClassNameBuilder('ReactionSelectorReaction');

const ReactionSelectorReaction: FC<OwnProps> = ({
  reaction,
  isReady,
  noAppearAnimation,
  chosen,
  onToggleReaction,
}) => {
  const mediaAppearData = useMedia(`sticker${reaction.appearAnimation?.id}`, !isReady || noAppearAnimation);
  const mediaData = useMedia(`document${reaction.selectAnimation?.id}`, !isReady || noAppearAnimation);
  const staticIconData = useMedia(`document${reaction.staticIcon?.id}`, !noAppearAnimation);
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
      {noAppearAnimation && (
        <img
          className={cn('static-icon')}
          src={staticIconData}
          alt={reaction.reaction.emoticon}
          draggable={false}
        />
      )}
      {!isAnimationLoaded && !noAppearAnimation && (
        <AnimatedSticker
          key={reaction.appearAnimation?.id}
          tgsUrl={mediaAppearData}
          play={isFirstPlay}
          noLoop
          size={REACTION_SIZE}
          onEnded={unmarkIsFirstPlay}
          forceAlways
        />
      )}
      {!isFirstPlay && !noAppearAnimation && (
        <AnimatedSticker
          key={reaction.selectAnimation?.id}
          tgsUrl={mediaData}
          play={isActivated}
          noLoop
          size={REACTION_SIZE}
          onLoad={markAnimationLoaded}
          onEnded={deactivate}
          forceAlways
        />
      )}
    </div>
  );
};

export default memo(ReactionSelectorReaction);
