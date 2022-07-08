import type { FC } from '../../../lib/teact/teact';
import React, { memo, useRef } from '../../../lib/teact/teact';

import type { ApiAvailableReaction } from '../../../api/types';

import useMedia from '../../../hooks/useMedia';
import useFlag from '../../../hooks/useFlag';
import useShowTransition from '../../../hooks/useShowTransition';
import { createClassNameBuilder } from '../../../util/buildClassName';
import { IS_COMPACT_MENU } from '../../../util/environment';

import AnimatedSticker from '../../common/AnimatedSticker';

import './ReactionSelectorReaction.scss';

const REACTION_SIZE = IS_COMPACT_MENU ? 24 : 32;

type OwnProps = {
  reaction: ApiAvailableReaction;
  previewIndex: number;
  isReady?: boolean;
  onSendReaction: (reaction: string, x: number, y: number) => void;
  isCurrentUserPremium?: boolean;
};

const cn = createClassNameBuilder('ReactionSelectorReaction');

const ReactionSelectorReaction: FC<OwnProps> = ({
  reaction, previewIndex, onSendReaction, isReady, isCurrentUserPremium,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const mediaData = useMedia(`document${reaction.selectAnimation?.id}`, !isReady);

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
      className={cn('&', IS_COMPACT_MENU && 'compact')}
      onClick={handleClick}
      ref={containerRef}
      onMouseEnter={isReady ? activate : undefined}
    >
      {shouldRenderStatic && (
        <div
          className={cn(
            'static',
            isCurrentUserPremium && 'premium',
            isReady ? [staticClassNames] : undefined,
          )}
          style={`background-position-x: ${previewIndex * -REACTION_SIZE}px;`}
        />
      )}
      {shouldRenderAnimated && (
        <AnimatedSticker
          className={cn('animated', [animatedClassNames])}
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
