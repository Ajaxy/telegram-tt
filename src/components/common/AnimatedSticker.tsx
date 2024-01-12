import type { RefObject } from 'react';
import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';

import type RLottieInstance from '../../lib/rlottie/RLottie';

import { requestMeasure } from '../../lib/fasterdom/fasterdom';
import { ensureRLottie, getRLottie } from '../../lib/rlottie/RLottie.async';
import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import generateUniqueId from '../../util/generateUniqueId';
import { hexToRgb } from '../../util/switchTheme';
import { IS_ELECTRON } from '../../util/windowEnvironment';

import useColorFilter from '../../hooks/stickers/useColorFilter';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import useHeavyAnimationCheck, { isHeavyAnimating } from '../../hooks/useHeavyAnimationCheck';
import useLastCallback from '../../hooks/useLastCallback';
import usePriorityPlaybackCheck, { isPriorityPlaybackActive } from '../../hooks/usePriorityPlaybackCheck';
import useSharedIntersectionObserver from '../../hooks/useSharedIntersectionObserver';
import { useStateRef } from '../../hooks/useStateRef';
import useSyncEffect from '../../hooks/useSyncEffect';
import useThrottledCallback from '../../hooks/useThrottledCallback';
import useUniqueId from '../../hooks/useUniqueId';
import useBackgroundMode, { isBackgroundModeActive } from '../../hooks/window/useBackgroundMode';

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
  size: number;
  quality?: number;
  color?: string;
  isLowPriority?: boolean;
  forceAlways?: boolean;
  forceOnHeavyAnimation?: boolean;
  sharedCanvas?: HTMLCanvasElement;
  sharedCanvasCoords?: { x: number; y: number };
  onClick?: NoneToVoidFunction;
  onLoad?: NoneToVoidFunction;
  onEnded?: NoneToVoidFunction;
  onLoop?: NoneToVoidFunction;
};

const THROTTLE_MS = 150;

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
  forceAlways,
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

  const viewId = useUniqueId();

  const [animation, setAnimation] = useState<RLottieInstance>();
  const animationRef = useRef<RLottieInstance>();
  const isFirstRender = useRef(true);

  const shouldUseColorFilter = !sharedCanvas && color;
  const colorFilter = useColorFilter(shouldUseColorFilter ? color : undefined);

  const playKey = play || (play === false ? false : playSegment);
  const playRef = useStateRef(play);
  const playSegmentRef = useStateRef(playSegment);

  const rgbColor = useRef<[number, number, number] | undefined>();

  useSyncEffect(() => {
    if (color && !shouldUseColorFilter) {
      const { r, g, b } = hexToRgb(color);
      rgbColor.current = [r, g, b];
    } else {
      rgbColor.current = undefined;
    }
  }, [color, shouldUseColorFilter]);

  const isUnmountedRef = useRef(false);
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  const init = useLastCallback(() => {
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

    const newAnimation = getRLottie().init(
      tgsUrl,
      container,
      renderId || generateUniqueId(),
      {
        size,
        noLoop,
        quality,
        isLowPriority,
        coords: sharedCanvasCoords,
      },
      viewId,
      rgbColor.current,
      onLoad,
      onEnded,
      onLoop,
    );

    if (speed) {
      newAnimation.setSpeed(speed);
    }

    setAnimation(newAnimation);
    animationRef.current = newAnimation;
  });

  useEffect(() => {
    if (getRLottie()) {
      init();
    } else {
      ensureRLottie().then(init);
    }
  }, [init, tgsUrl, sharedCanvas, sharedCanvasCoords]);

  const throttledInit = useThrottledCallback(init, [init], THROTTLE_MS);
  useSharedIntersectionObserver(sharedCanvas, throttledInit);

  useEffect(() => {
    if (!animation) return;

    animation.setColor(rgbColor.current);
  }, [color, animation]);

  useEffect(() => {
    return () => {
      animationRef.current?.removeView(viewId);
    };
  }, [viewId]);

  const playAnimation = useLastCallback((shouldRestart = false) => {
    if (
      !animation
      || !(playRef.current || playSegmentRef.current)
      || isFrozen(forceAlways)
    ) {
      return;
    }

    if (playSegmentRef.current) {
      animation.playSegment(playSegmentRef.current, shouldRestart, viewId);
    } else {
      animation.play(shouldRestart, viewId);
    }
  });

  const playAnimationOnRaf = useLastCallback(() => {
    requestMeasure(playAnimation);
  });

  const pauseAnimation = useLastCallback(() => {
    if (animation?.isPlaying()) {
      animation.pause(viewId);
    }
  });

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

    if (playKey) {
      if (!isFrozen(forceAlways, forceOnHeavyAnimation)) {
        playAnimation(noLoop);
      }
    } else {
      pauseAnimation();
    }
  }, [animation, playKey, noLoop, playAnimation, pauseAnimation, forceAlways, forceOnHeavyAnimation]);

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

  useHeavyAnimationCheck(pauseAnimation, playAnimation, !playKey || forceAlways || forceOnHeavyAnimation);
  usePriorityPlaybackCheck(pauseAnimation, playAnimation, !playKey || forceAlways);
  // Pausing frame may not happen in background,
  // so we need to make sure it happens right after focusing,
  // then we can play again.
  useBackgroundMode(pauseAnimation, playAnimationOnRaf, !playKey || forceAlways);

  if (sharedCanvas) {
    return undefined;
  }

  return (
    <div
      ref={containerRef}
      className={buildClassName('AnimatedSticker', className)}
      style={buildStyle(
        size !== undefined && `width: ${size}px; height: ${size}px;`,
        onClick && !IS_ELECTRON && 'cursor: pointer',
        colorFilter,
        style,
      )}
      onClick={onClick}
    />
  );
};

export default memo(AnimatedSticker);

function isFrozen(forceAlways = false, forceOnHeavyAnimation = false) {
  if (forceAlways) return false;
  return (!forceOnHeavyAnimation && isHeavyAnimating()) || isPriorityPlaybackActive() || isBackgroundModeActive();
}
