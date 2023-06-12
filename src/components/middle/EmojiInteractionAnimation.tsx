import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useLayoutEffect, useRef,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ActiveEmojiInteraction } from '../../global/types';

import { IS_ANDROID } from '../../util/windowEnvironment';

import {
  selectAnimatedEmojiEffect,
} from '../../global/selectors';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';

import useLastCallback from '../../hooks/useLastCallback';
import useFlag from '../../hooks/useFlag';
import useMedia from '../../hooks/useMedia';
import buildClassName from '../../util/buildClassName';

import AnimatedSticker from '../common/AnimatedSticker';

import './EmojiInteractionAnimation.scss';

export type OwnProps = {
  activeEmojiInteraction: ActiveEmojiInteraction;
};

type StateProps = {
  effectAnimationId?: string;
};

const HIDE_ANIMATION_DURATION = 250;
const PLAYING_DURATION = 3000;
const EFFECT_SIZE = 309;

const EmojiInteractionAnimation: FC<OwnProps & StateProps> = ({
  effectAnimationId,
  activeEmojiInteraction,
}) => {
  const { stopActiveEmojiInteraction } = getActions();

  const [isHiding, startHiding] = useFlag(false);
  const [isPlaying, startPlaying] = useFlag(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const stop = useLastCallback(() => {
    startHiding();
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setTimeout(() => {
      stopActiveEmojiInteraction({ id: activeEmojiInteraction.id });
    }, HIDE_ANIMATION_DURATION);
  });

  const handleCancelAnimation = useLastCallback((e: UIEvent) => {
    if (!(e.target as HTMLElement)?.closest('.AnimatedEmoji')) {
      stop();
    }
  });

  useEffect(() => {
    document.addEventListener('touchstart', handleCancelAnimation);
    document.addEventListener('touchmove', handleCancelAnimation);
    document.addEventListener('mousedown', handleCancelAnimation);
    document.addEventListener('wheel', handleCancelAnimation);

    return () => {
      document.removeEventListener('touchstart', handleCancelAnimation);
      document.removeEventListener('touchmove', handleCancelAnimation);
      document.removeEventListener('mousedown', handleCancelAnimation);
      document.removeEventListener('wheel', handleCancelAnimation);
    };
  }, [handleCancelAnimation]);

  useLayoutEffect(() => {
    const dispatchHeavyAnimationStop = dispatchHeavyAnimationEvent();

    timeoutRef.current = setTimeout(() => {
      stop();
      dispatchHeavyAnimationStop();
    }, PLAYING_DURATION);
  }, [stop]);

  const effectHash = effectAnimationId && `sticker${effectAnimationId}`;
  const effectTgsUrl = useMedia(effectHash, !effectAnimationId);

  if (!activeEmojiInteraction.startSize) {
    return undefined;
  }

  const scale = (activeEmojiInteraction.startSize || 0) / EFFECT_SIZE;

  return (
    <div
      className={buildClassName(
        'EmojiInteractionAnimation',
        isHiding && 'hiding',
        isPlaying && 'playing',
        activeEmojiInteraction.isReversed && 'reversed',
      )}
      style={`--scale: ${scale}; --start-x: ${activeEmojiInteraction.x}px; --start-y: ${activeEmojiInteraction.y}px;`}
    >
      <AnimatedSticker
        key={`effect_${effectAnimationId}`}
        size={EFFECT_SIZE}
        tgsUrl={effectTgsUrl}
        play
        quality={IS_ANDROID ? 0.5 : undefined}
        forceOnHeavyAnimation
        noLoop
        onLoad={startPlaying}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { activeEmojiInteraction }): StateProps => {
    const animatedEffect = activeEmojiInteraction.animatedEffect !== undefined
      && selectAnimatedEmojiEffect(global, activeEmojiInteraction.animatedEffect);
    return {
      effectAnimationId: animatedEffect ? animatedEffect.id : undefined,
    };
  },
)(EmojiInteractionAnimation));
