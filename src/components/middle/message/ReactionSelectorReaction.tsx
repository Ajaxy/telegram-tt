import React, {
  FC, memo, useRef,
} from '../../../lib/teact/teact';

import { ApiAvailableReaction, ApiMediaFormat } from '../../../api/types';

import useMedia from '../../../hooks/useMedia';
import useFlag from '../../../hooks/useFlag';
import useShowTransition from '../../../hooks/useShowTransition';
import { createClassNameBuilder } from '../../../util/buildClassName';

import AnimatedSticker from '../../common/AnimatedSticker';

import './ReactionSelectorReaction.scss';

const REACTION_SIZE = 32;

type OwnProps = {
  reaction: ApiAvailableReaction;
  isReady?: boolean;
  onSendReaction: (reaction: string, x: number, y: number) => void;
};

const cn = createClassNameBuilder('ReactionSelectorReaction');

const ReactionSelectorReaction: FC<OwnProps> = ({ reaction, onSendReaction, isReady }) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const mediaData = useMedia(`document${reaction.selectAnimation?.id}`, !isReady, ApiMediaFormat.Lottie);

  const [isActivated, activate, deactivate] = useFlag();
  const [isAnimationLoaded, markAnimationLoaded] = useFlag();

  const shouldRenderAnimated = Boolean(isReady && mediaData);
  const { transitionClassNames: animatedClassNames } = useShowTransition(shouldRenderAnimated);
  const { shouldRender: shouldRenderStatic, transitionClassNames: staticClassNames } = useShowTransition(
    !isReady || !isAnimationLoaded, undefined, true,
  );

  function handleClick() {
    if (!containerRef.current) return;
    const { x, y } = containerRef.current.getBoundingClientRect();

    onSendReaction(reaction.reaction, x, y);
  }

  return (
    <div
      className={cn('&')}
      onClick={handleClick}
      ref={containerRef}
      onMouseEnter={isReady ? activate : undefined}
    >
      {shouldRenderStatic && (
        <div
          className={cn(
            'static',
            `reaction-${reaction.reaction}`,
            isReady ? [staticClassNames] : undefined,
          )}
        />
      )}
      {shouldRenderAnimated && (
        <AnimatedSticker
          id={`select_${reaction.reaction}`}
          className={cn('animated', [animatedClassNames])}
          animationData={mediaData}
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
