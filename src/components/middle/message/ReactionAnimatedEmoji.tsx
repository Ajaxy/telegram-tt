import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ActiveReaction } from '../../../global/types';
import type { ApiAvailableReaction } from '../../../api/types';

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
  const { stopActiveReaction } = getActions();

  const availableReaction = availableReactions?.find((r) => r.reaction === reaction);
  const centerIconId = availableReaction?.centerIcon?.id;
  const effectId = availableReaction?.aroundAnimation?.id;
  const mediaDataCenterIcon = useMedia(`sticker${centerIconId}`, !centerIconId);
  const mediaDataEffect = useMedia(`sticker${effectId}`, !effectId);

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
            className={animationClassNames}
            size={CENTER_ICON_SIZE}
            tgsUrl={mediaDataCenterIcon}
            play
            noLoop
            forceOnHeavyAnimation
            onLoad={markAnimationLoaded}
            onEnded={unmarkAnimationLoaded}
          />
          <AnimatedSticker
            key={effectId}
            className={buildClassName('effect', animationClassNames)}
            size={EFFECT_SIZE}
            tgsUrl={mediaDataEffect}
            play
            noLoop
            forceOnHeavyAnimation
            onEnded={handleEnded}
          />
        </>
      )}
    </div>
  );
};

export default memo(ReactionAnimatedEmoji);
