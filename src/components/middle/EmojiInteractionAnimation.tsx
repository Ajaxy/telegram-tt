import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useLayoutEffect, useRef,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ActiveEmojiInteraction } from '../../global/types';

import { IS_ANDROID } from '../../util/environment';
import useFlag from '../../hooks/useFlag';
import useMedia from '../../hooks/useMedia';
import buildClassName from '../../util/buildClassName';
import {
  selectAnimatedEmojiEffect,
} from '../../global/selectors';
import { LOCAL_TGS_URLS } from '../common/helpers/animatedAssets';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';

import AnimatedSticker from '../common/AnimatedSticker';

import './EmojiInteractionAnimation.scss';

export type OwnProps = {
  activeEmojiInteraction: ActiveEmojiInteraction;
};

type StateProps = {
  effectAnimationId?: string;
  localEffectAnimation?: string;
};

const HIDE_ANIMATION_DURATION = 250;
const PLAYING_DURATION = 3000;
const EFFECT_SIZE = 309;

const EmojiInteractionAnimation: FC<OwnProps & StateProps> = ({
  effectAnimationId,
  localEffectAnimation,
  activeEmojiInteraction,
}) => {
  const { stopActiveEmojiInteraction } = getActions();

  const [isHiding, startHiding] = useFlag(false);
  const [isPlaying, startPlaying] = useFlag(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const stop = useCallback(() => {
    startHiding();
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setTimeout(() => {
      stopActiveEmojiInteraction({ id: activeEmojiInteraction.id });
    }, HIDE_ANIMATION_DURATION);
  }, [activeEmojiInteraction.id, startHiding, stopActiveEmojiInteraction]);

  const handleCancelAnimation = useCallback((e: UIEvent) => {
    if (!(e.target as HTMLElement)?.closest('.AnimatedEmoji')) {
      stop();
    }
  }, [stop]);

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

  const effectTgsUrl = useMedia(`sticker${effectAnimationId}`, !effectAnimationId);

  if (!activeEmojiInteraction.startSize) {
    return undefined;
  }

  const scale = (activeEmojiInteraction.startSize || 0) / EFFECT_SIZE;
  const tgsUrl = localEffectAnimation && (localEffectAnimation in LOCAL_TGS_URLS)
    ? LOCAL_TGS_URLS[localEffectAnimation as keyof typeof LOCAL_TGS_URLS]
    : effectTgsUrl;

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
        tgsUrl={tgsUrl}
        play={isPlaying}
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
      localEffectAnimation: !animatedEffect && activeEmojiInteraction.animatedEffect
      && Object.keys(LOCAL_TGS_URLS).includes(activeEmojiInteraction.animatedEffect)
        ? activeEmojiInteraction.animatedEffect : undefined,
    };
  },
)(EmojiInteractionAnimation));
