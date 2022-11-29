import type { RefObject } from 'react';
import type { FC } from '../../lib/teact/teact';

import React, {
  useEffect, useRef, memo, useCallback, useState, useMemo,
} from '../../lib/teact/teact';

import { fastRaf } from '../../util/schedulers';
import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';

import useHeavyAnimationCheck from '../../hooks/useHeavyAnimationCheck';
import useBackgroundMode from '../../hooks/useBackgroundMode';
import useOnChange from '../../hooks/useOnChange';
import generateIdFor from '../../util/generateIdFor';

export type OwnProps = {
  ref?: RefObject<HTMLDivElement>;
  animationId?: string;
  className?: string;
  style?: string;
  tgsUrl?: string;
  play?: boolean | string;
  playSegment?: [number, number];
  speed?: number;
  noLoop?: boolean;
  size: number;
  quality?: number;
  color?: [number, number, number];
  isLowPriority?: boolean;
  forceOnHeavyAnimation?: boolean;
  sharedCanvas?: HTMLCanvasElement;
  sharedCanvasCoords?: { x: number; y: number };
  onClick?: NoneToVoidFunction;
  onLoad?: NoneToVoidFunction;
  onEnded?: NoneToVoidFunction;
  onLoop?: NoneToVoidFunction;
};

type RLottieClass = typeof import('../../lib/rlottie/RLottie').default;
type RLottieInstance = import('../../lib/rlottie/RLottie').default;
let lottiePromise: Promise<RLottieClass>;
let RLottie: RLottieClass;

// Time for the main interface to completely load
const LOTTIE_LOAD_DELAY = 3000;
const ID_STORE = {};

async function ensureLottie() {
  if (!lottiePromise) {
    lottiePromise = import('../../lib/rlottie/RLottie') as unknown as Promise<RLottieClass>;
    RLottie = (await lottiePromise as any).default;
  }

  return lottiePromise;
}

setTimeout(ensureLottie, LOTTIE_LOAD_DELAY);

const AnimatedSticker: FC<OwnProps> = ({
  ref,
  animationId,
  className,
  style,
  tgsUrl,
  play,
  playSegment,
  speed,
  noLoop,
  size,
  quality,
  isLowPriority,
  color,
  forceOnHeavyAnimation,
  sharedCanvas,
  sharedCanvasCoords,
  onClick,
  onLoad,
  onEnded,
  onLoop,
}) => {
  // eslint-disable-next-line no-null/no-null
  let containerRef = useRef<HTMLDivElement>(null);
  if (ref) {
    containerRef = ref;
  }

  const containerId = useMemo(() => generateIdFor(ID_STORE, true), []);

  const [animation, setAnimation] = useState<RLottieInstance>();
  const wasPlaying = useRef(false);
  const isFrozen = useRef(false);
  const isFirstRender = useRef(true);

  const playRef = useRef();
  playRef.current = play;
  const playSegmentRef = useRef<[number, number]>();
  playSegmentRef.current = playSegment;

  const isUnmountedRef = useRef();
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (animation || !tgsUrl || (sharedCanvas && !sharedCanvasCoords)) {
      return;
    }

    const exec = () => {
      if (isUnmountedRef.current) {
        return;
      }

      const container = containerRef.current || sharedCanvas;
      if (!container) {
        return;
      }

      const newAnimation = RLottie.init(
        containerId,
        container,
        onLoad,
        animationId || generateIdFor(ID_STORE, true),
        tgsUrl,
        {
          noLoop,
          size,
          quality,
          isLowPriority,
          coords: sharedCanvasCoords,
        },
        color,
        onEnded,
        onLoop,
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
          if (containerRef.current) {
            exec();
          }
        });
      });
    }
  }, [
    animation, animationId, tgsUrl, color, isLowPriority, noLoop, onLoad, quality, size, speed, onEnded, onLoop,
    containerId, sharedCanvas, sharedCanvasCoords,
  ]);

  useEffect(() => {
    if (!animation) return;

    animation.setColor(color);
  }, [color, animation]);

  useEffect(() => {
    return () => {
      if (animation) {
        animation.removeContainer(containerId);
      }
    };
  }, [animation, containerId]);

  const playAnimation = useCallback((shouldRestart = false) => {
    if (animation && (playRef.current || playSegmentRef.current)) {
      if (playSegmentRef.current) {
        animation.playSegment(playSegmentRef.current);
      } else {
        animation.play(shouldRestart, containerId);
      }
    }
  }, [animation, containerId]);

  const pauseAnimation = useCallback(() => {
    if (!animation) {
      return;
    }

    animation.pause(containerId);
  }, [animation, containerId]);

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
      playAnimation(noLoop);
    }

    wasPlaying.current = false;
    isFrozen.current = false;
  }, [noLoop, playAnimation]);

  const unfreezeAnimationOnRaf = useCallback(() => {
    fastRaf(unfreezeAnimation);
  }, [unfreezeAnimation]);

  useOnChange(([prevNoLoop]) => {
    if (prevNoLoop !== undefined && noLoop !== prevNoLoop) {
      animation?.setNoLoop(noLoop);
    }
  }, [noLoop, animation]);

  useOnChange(([prevSharedCanvasCoords]) => {
    if (prevSharedCanvasCoords !== undefined && sharedCanvasCoords !== prevSharedCanvasCoords) {
      animation?.setSharedCanvasCoords(containerId, sharedCanvasCoords);
    }
  }, [sharedCanvasCoords, containerId, animation]);

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
      } else if (tgsUrl) {
        animation.changeData(tgsUrl);
        playAnimation();
      }
    }
  }, [playAnimation, animation, tgsUrl]);

  useHeavyAnimationCheck(freezeAnimation, unfreezeAnimation, forceOnHeavyAnimation);
  // Pausing frame may not happen in background,
  // so we need to make sure it happens right after focusing,
  // then we can play again.
  useBackgroundMode(freezeAnimation, unfreezeAnimationOnRaf);

  if (sharedCanvas) {
    return undefined;
  }

  return (
    <div
      ref={containerRef}
      className={buildClassName('AnimatedSticker', className)}
      style={buildStyle(
        size !== undefined && `width: ${size}px; height: ${size}px;`,
        onClick && 'cursor: pointer',
        style,
      )}
      onClick={onClick}
    />
  );
};

export default memo(AnimatedSticker);
