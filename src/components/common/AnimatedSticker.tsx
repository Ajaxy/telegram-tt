import type { RefObject } from 'react';
import type { FC } from '../../lib/teact/teact';
import { requestMeasure } from '../../lib/fasterdom/fasterdom';

import React, {
  useEffect, useRef, memo, useCallback, useState, useMemo,
} from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import generateIdFor from '../../util/generateIdFor';

import useHeavyAnimationCheck, { isHeavyAnimating } from '../../hooks/useHeavyAnimationCheck';
import usePriorityPlaybackCheck, { isPriorityPlaybackActive } from '../../hooks/usePriorityPlaybackCheck';
import useBackgroundMode, { isBackgroundModeActive } from '../../hooks/useBackgroundMode';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import { useStateRef } from '../../hooks/useStateRef';
import useSharedIntersectionObserver from '../../hooks/useSharedIntersectionObserver';
import useThrottledCallback from '../../hooks/useThrottledCallback';

export type OwnProps = {
  ref?: RefObject<HTMLDivElement>;
  renderId?: string;
  className?: string;
  style?: string;
  tgsUrl?: string;
  play?: boolean | string;
  playSegment?: [number, number];
  speed?: number;
  noLoop?: boolean;
  size?: number;
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
const THROTTLE_MS = 150;
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
  renderId,
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

  const viewId = useMemo(() => generateIdFor(ID_STORE, true), []);

  const [animation, setAnimation] = useState<RLottieInstance>();
  const animationRef = useRef<RLottieInstance>();
  const isFirstRender = useRef(true);

  const canPlay = play || playSegment;
  const playRef = useStateRef(play);
  const playSegmentRef = useStateRef(playSegment);

  const isUnmountedRef = useRef(false);
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  const init = useCallback(() => {
    if (
      animationRef.current
      || isUnmountedRef.current
      || !tgsUrl
      || (sharedCanvas && (!sharedCanvasCoords || !sharedCanvas.offsetWidth || !sharedCanvas.offsetHeight))
    ) {
      return;
    }

    const container = containerRef.current || sharedCanvas;
    if (!container) {
      return;
    }

    const newAnimation = RLottie.init(
      tgsUrl,
      container,
      renderId || generateIdFor(ID_STORE, true),
      viewId,
      {
        noLoop,
        size,
        quality,
        isLowPriority,
        coords: sharedCanvasCoords,
      },
      color,
      onLoad,
      onEnded,
      onLoop,
    );

    if (speed) {
      newAnimation.setSpeed(speed);
    }

    setAnimation(newAnimation);
    animationRef.current = newAnimation;
  }, [
    color, isLowPriority, noLoop, onEnded, onLoad, onLoop, quality,
    renderId, sharedCanvas, sharedCanvasCoords, size, speed, tgsUrl, viewId,
  ]);

  useEffect(() => {
    if (animation || !tgsUrl || (sharedCanvas && !sharedCanvasCoords)) {
      return;
    }

    if (RLottie) {
      init();
    } else {
      ensureLottie().then(() => {
        requestMeasure(init);
      });
    }
  }, [animation, init, sharedCanvas, sharedCanvasCoords, tgsUrl]);

  const throttledInit = useThrottledCallback(init, [init], THROTTLE_MS);
  useSharedIntersectionObserver(sharedCanvas, throttledInit);

  useEffect(() => {
    if (!animation) return;

    animation.setColor(color);
  }, [color, animation]);

  useEffect(() => {
    return () => {
      animationRef.current?.removeView(viewId);
    };
  }, [viewId]);

  const playAnimation = useCallback((shouldRestart = false) => {
    if (
      !animation
      || !(playRef.current || playSegmentRef.current)
      || isFrozen()
    ) {
      return;
    }

    if (playSegmentRef.current) {
      animation.playSegment(playSegmentRef.current, viewId);
    } else {
      animation.play(shouldRestart, viewId);
    }
  }, [animation, playRef, playSegmentRef, viewId]);

  const playAnimationOnRaf = useCallback(() => {
    requestMeasure(playAnimation);
  }, [playAnimation]);

  const pauseAnimation = useCallback(() => {
    if (animation?.isPlaying()) {
      animation.pause(viewId);
    }
  }, [animation, viewId]);

  useEffectWithPrevDeps(([prevNoLoop]) => {
    if (prevNoLoop !== undefined && noLoop !== prevNoLoop) {
      animation?.setNoLoop(noLoop);
    }
  }, [noLoop, animation]);

  useEffectWithPrevDeps(([prevSharedCanvasCoords]) => {
    if (prevSharedCanvasCoords !== undefined && sharedCanvasCoords !== prevSharedCanvasCoords) {
      animation?.setSharedCanvasCoords(viewId, sharedCanvasCoords);
    }
  }, [sharedCanvasCoords, viewId, animation]);

  useEffect(() => {
    if (!animation) {
      return;
    }

    if (canPlay) {
      if (!isFrozen()) {
        playAnimation(noLoop);
      }
    } else {
      pauseAnimation();
    }
  }, [animation, canPlay, noLoop, playAnimation, pauseAnimation]);

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

  useHeavyAnimationCheck(pauseAnimation, playAnimation, !canPlay || forceOnHeavyAnimation);
  usePriorityPlaybackCheck(pauseAnimation, playAnimation, !canPlay);
  // Pausing frame may not happen in background,
  // so we need to make sure it happens right after focusing,
  // then we can play again.
  useBackgroundMode(pauseAnimation, playAnimationOnRaf, !canPlay);

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

function isFrozen() {
  return isHeavyAnimating() || isPriorityPlaybackActive() || isBackgroundModeActive();
}
