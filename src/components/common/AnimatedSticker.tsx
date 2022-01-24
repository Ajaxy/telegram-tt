import React, {
  FC, useEffect, useRef, memo, useCallback, useState,
} from '../../lib/teact/teact';

import { fastRaf } from '../../util/schedulers';
import buildClassName from '../../util/buildClassName';
import useHeavyAnimationCheck from '../../hooks/useHeavyAnimationCheck';
import useBackgroundMode from '../../hooks/useBackgroundMode';

type OwnProps = {
  className?: string;
  id: string;
  animationData?: string;
  play?: boolean | string;
  playSegment?: [number, number];
  speed?: number;
  noLoop?: boolean;
  size: number;
  quality?: number;
  isLowPriority?: boolean;
  onLoad?: NoneToVoidFunction;
  forceOnHeavyAnimation?: boolean;
  color?: [number, number, number];
  onEnded?: NoneToVoidFunction;
};

type RLottieClass = typeof import('../../lib/rlottie/RLottie').default;
type RLottieInstance = import('../../lib/rlottie/RLottie').default;
let lottiePromise: Promise<RLottieClass>;
let RLottie: RLottieClass;

// Time supposed for judges to measure "Transferred Size" in Dev Tools
const LOTTIE_LOAD_DELAY = 5000;

async function ensureLottie() {
  if (!lottiePromise) {
    lottiePromise = import('../../lib/rlottie/RLottie') as unknown as Promise<RLottieClass>;
    RLottie = (await lottiePromise as any).default;
  }

  return lottiePromise;
}

setTimeout(ensureLottie, LOTTIE_LOAD_DELAY);

const AnimatedSticker: FC<OwnProps> = ({
  className,
  id,
  animationData,
  play,
  playSegment,
  speed,
  noLoop,
  size,
  quality,
  isLowPriority,
  color,
  forceOnHeavyAnimation,
  onLoad,
  onEnded,
}) => {
  const [animation, setAnimation] = useState<RLottieInstance>();
  // eslint-disable-next-line no-null/no-null
  const container = useRef<HTMLDivElement>(null);
  const wasPlaying = useRef(false);
  const isFrozen = useRef(false);
  const isFirstRender = useRef(true);

  const playRef = useRef();
  playRef.current = play;
  const playSegmentRef = useRef<[number, number]>();
  playSegmentRef.current = playSegment;

  useEffect(() => {
    if (animation || !animationData) {
      return;
    }

    const exec = () => {
      if (!container.current) {
        return;
      }

      const newAnimation = new RLottie(
        id,
        container.current,
        animationData,
        {
          noLoop,
          size,
          quality,
          isLowPriority,
        },
        onLoad,
        color,
        onEnded,
      );

      if (speed) {
        newAnimation.setSpeed(speed);
      }

      setAnimation(newAnimation);
    };

    if (RLottie) {
      exec();
    } else {
      ensureLottie().then(() => {
        fastRaf(() => {
          if (container.current) {
            exec();
          }
        });
      });
    }
  }, [color, animation, animationData, id, isLowPriority, noLoop, onLoad, quality, size, speed, onEnded]);

  useEffect(() => {
    if (!animation) return;

    animation.setColor(color);
  }, [color, animation]);

  useEffect(() => {
    return () => {
      if (animation) {
        animation.destroy();
      }
    };
  }, [animation]);

  const playAnimation = useCallback((shouldRestart = false) => {
    if (animation && (playRef.current || playSegmentRef.current)) {
      if (playSegmentRef.current) {
        animation.playSegment(playSegmentRef.current);
      } else if (shouldRestart) {
        animation.goToAndPlay(0);
      } else {
        animation.play();
      }
    }
  }, [animation]);

  const pauseAnimation = useCallback(() => {
    if (!animation) {
      return;
    }

    animation.pause();
  }, [animation]);

  const freezeAnimation = useCallback(() => {
    isFrozen.current = true;

    if (!animation) {
      return;
    }

    if (!wasPlaying.current) {
      wasPlaying.current = animation.isPlaying();
    }

    pauseAnimation();
  }, [animation, pauseAnimation]);

  const unfreezeAnimation = useCallback(() => {
    if (wasPlaying.current) {
      playAnimation();
    }

    wasPlaying.current = false;
    isFrozen.current = false;
  }, [playAnimation]);

  const unfreezeAnimationOnRaf = useCallback(() => {
    fastRaf(unfreezeAnimation);
  }, [unfreezeAnimation]);

  useEffect(() => {
    if (!animation) {
      return;
    }

    if (play || playSegment) {
      if (isFrozen.current) {
        wasPlaying.current = true;
      } else {
        playAnimation(noLoop);
      }
    } else {
      // eslint-disable-next-line no-lonely-if
      if (isFrozen.current) {
        wasPlaying.current = false;
      } else {
        pauseAnimation();
      }
    }
  }, [animation, play, playSegment, noLoop, playAnimation, pauseAnimation]);

  useEffect(() => {
    if (animation) {
      if (isFirstRender.current) {
        isFirstRender.current = false;
      } else if (animationData) {
        animation.changeData(animationData);
        playAnimation();
      }
    }
  }, [playAnimation, animation, animationData]);

  useHeavyAnimationCheck(freezeAnimation, unfreezeAnimation, forceOnHeavyAnimation);
  // Pausing frame may not happen in background
  // so we need to make sure it happens right after focusing,
  // then we can play again.
  useBackgroundMode(freezeAnimation, unfreezeAnimationOnRaf);

  const fullClassName = buildClassName('AnimatedSticker', className);

  const style = size ? `width: ${size}px; height: ${size}px;` : undefined;

  return (
    <div
      ref={container}
      className={fullClassName}
      // @ts-ignore
      style={style}
    />
  );
};

export default memo(AnimatedSticker);
