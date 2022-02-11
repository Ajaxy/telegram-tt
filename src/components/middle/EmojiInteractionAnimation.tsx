import React, {
  FC, memo, useCallback, useEffect, useLayoutEffect, useState,
} from '../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../lib/teact/teactn';

import { ActiveEmojiInteraction } from '../../global/types';
import { ApiMediaFormat } from '../../api/types';

import { IS_ANDROID } from '../../util/environment';
import useFlag from '../../hooks/useFlag';
import useMedia from '../../hooks/useMedia';
import buildClassName from '../../util/buildClassName';
import {
  selectAnimatedEmojiEffect,
} from '../../modules/selectors';
import getAnimationData, { ANIMATED_STICKERS_PATHS } from '../common/helpers/animatedAssets';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';

import AnimatedSticker from '../common/AnimatedSticker';

import './EmojiInteractionAnimation.scss';

export type OwnProps = {
  emojiInteraction: ActiveEmojiInteraction;
};

type StateProps = {
  effectAnimationId?: string;
  localEffectAnimation?: string;
  isReversed?: boolean;
};

const HIDE_ANIMATION_DURATION = 250;
const PLAYING_DURATION = 3000;
const EFFECT_SIZE = 240;

const EmojiInteractionAnimation: FC<OwnProps & StateProps> = ({
  emojiInteraction,
  effectAnimationId,
  localEffectAnimation,
  isReversed,
}) => {
  const { stopActiveEmojiInteraction } = getDispatch();

  const [isHiding, startHiding] = useFlag(false);
  const [isPlaying, startPlaying] = useFlag(false);

  const stop = useCallback(() => {
    startHiding();
    setTimeout(() => {
      stopActiveEmojiInteraction();
    }, HIDE_ANIMATION_DURATION);
  }, [startHiding, stopActiveEmojiInteraction]);

  useEffect(() => {
    document.addEventListener('touchstart', stop);
    document.addEventListener('touchmove', stop);
    document.addEventListener('mousedown', stop);
    document.addEventListener('wheel', stop);

    return () => {
      document.removeEventListener('touchstart', stop);
      document.removeEventListener('touchmove', stop);
      document.removeEventListener('mousedown', stop);
      document.removeEventListener('wheel', stop);
    };
  }, [stop]);

  useLayoutEffect(() => {
    const dispatchHeavyAnimationStop = dispatchHeavyAnimationEvent();

    setTimeout(() => {
      stop();
      dispatchHeavyAnimationStop();
    }, PLAYING_DURATION);
  }, [stop]);

  const effectAnimationData = useMedia(`sticker${effectAnimationId}`, !effectAnimationId, ApiMediaFormat.Lottie);

  const [localEffectAnimationData, setLocalEffectAnimationData] = useState<string | undefined>();
  useEffect(() => {
    if (localEffectAnimation) {
      getAnimationData(localEffectAnimation as keyof typeof ANIMATED_STICKERS_PATHS).then((data) => {
        setLocalEffectAnimationData(data);
      });
    }
  }, [localEffectAnimation]);

  const scale = (emojiInteraction.startSize || 0) / EFFECT_SIZE;

  return (
    <div
      className={buildClassName(
        'EmojiInteractionAnimation', isHiding && 'hiding', isPlaying && 'playing', isReversed && 'reversed',
      )}
      style={`--scale: ${scale}; --start-x: ${emojiInteraction.x}px; --start-y: ${emojiInteraction.y}px;`}
    >
      <AnimatedSticker
        id={`effect_${effectAnimationId}`}
        size={EFFECT_SIZE}
        animationData={localEffectAnimationData || effectAnimationData}
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
  (global, { emojiInteraction }): StateProps => {
    const animatedEffect = emojiInteraction.animatedEffect !== undefined
      && selectAnimatedEmojiEffect(global, emojiInteraction.animatedEffect);
    return {
      effectAnimationId: animatedEffect ? animatedEffect.id : undefined,
      localEffectAnimation: !animatedEffect && emojiInteraction.animatedEffect
      && Object.keys(ANIMATED_STICKERS_PATHS).includes(emojiInteraction.animatedEffect)
        ? emojiInteraction.animatedEffect : undefined,
      isReversed: emojiInteraction.isReversed,
    };
  },
)(EmojiInteractionAnimation));
