import React, { FC, memo, useCallback } from '../../../lib/teact/teact';
import { getDispatch } from '../../../lib/teact/teactn';

import { ActiveReaction } from '../../../global/types';
import { ApiAvailableReaction, ApiMediaFormat } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import useMedia from '../../../hooks/useMedia';
import useShowTransition from '../../../hooks/useShowTransition';
import useFlag from '../../../hooks/useFlag';

import ReactionStaticEmoji from '../../common/ReactionStaticEmoji';
import AnimatedSticker from '../../common/AnimatedSticker';

import './ReactionAnimatedEmoji.scss';

type OwnProps = {
  reaction: string;
  activeReaction?: ActiveReaction;
  isInMeta?: boolean;
  availableReactions?: ApiAvailableReaction[];
};

const CENTER_ICON_SIZE = 30;
const EFFECT_SIZE = 100;

const ReactionAnimatedEmoji: FC<OwnProps> = ({
  reaction,
  activeReaction,
  isInMeta,
  availableReactions,
}) => {
  const { stopActiveReaction } = getDispatch();

  const availableReaction = availableReactions?.find((r) => r.reaction === reaction);
  const centerIconId = availableReaction?.centerIcon?.id;
  const effectId = availableReaction?.aroundAnimation?.id;
  const mediaDataCenterIcon = useMedia(`sticker${centerIconId}`, !centerIconId, ApiMediaFormat.Lottie);
  const mediaDataEffect = useMedia(`sticker${effectId}`, !effectId, ApiMediaFormat.Lottie);

  const shouldPlay = Boolean(activeReaction?.reaction === reaction && mediaDataCenterIcon && mediaDataEffect);
  const {
    shouldRender: shouldRenderAnimation,
    transitionClassNames: animationClassNames,
  } = useShowTransition(shouldPlay, undefined, true, 'slow');

  const handleEnded = useCallback(() => {
    stopActiveReaction({ messageId: activeReaction?.messageId, reaction });
  }, [activeReaction?.messageId, reaction, stopActiveReaction]);

  const [isAnimationLoaded, markAnimationLoaded, unmarkAnimationLoaded] = useFlag();
  const shouldRenderStatic = !shouldPlay || !isAnimationLoaded;

  const className = buildClassName(
    'ReactionAnimatedEmoji',
    isInMeta && 'in-meta',
    shouldRenderAnimation && 'is-animating',
  );

  return (
    <div className={className}>
      {shouldRenderStatic && <ReactionStaticEmoji reaction={reaction} />}
      {shouldRenderAnimation && (
        <>
          <AnimatedSticker
            key={centerIconId}
            id={`reaction_emoji_${centerIconId}`}
            className={animationClassNames}
            size={CENTER_ICON_SIZE}
            animationData={mediaDataCenterIcon}
            play
            noLoop
            onLoad={markAnimationLoaded}
            onEnded={unmarkAnimationLoaded}
          />
          <AnimatedSticker
            key={effectId}
            id={`reaction_effect_${effectId}`}
            className={buildClassName('effect', animationClassNames)}
            size={EFFECT_SIZE}
            animationData={mediaDataEffect}
            play
            noLoop
            onEnded={handleEnded}
          />
        </>
      )}
    </div>
  );
};

export default memo(ReactionAnimatedEmoji);
