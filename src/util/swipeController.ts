import type { MoveOffsets } from './captureEvents';

import { requestMeasure, requestMutation } from '../lib/fasterdom/fasterdom';
import { animateNumber, timingFunctions } from './animation';
import { captureEvents, SwipeDirection } from './captureEvents';
import { waitForAnimationEnd } from './cssAnimationEndListeners';
import { clamp } from './math';
import { IS_IOS } from './windowEnvironment';

const INERTIA_DURATION = 300;
const INERTIA_EASING = timingFunctions.easeOutCubic;

let isSwipeActive = false;
let swipeOffsets: MoveOffsets | undefined;
let onDrag: ((offsets: MoveOffsets) => void) | undefined;
let onRelease: ((onCancel: NoneToVoidFunction) => void) | undefined;
let cancelCurrentReleaseAnimation: NoneToVoidFunction | undefined;

export function captureControlledSwipe(
  element: HTMLElement, options: {
    excludedClosestSelector?: string;
    selectorToPreventScroll?: string;
    onSwipeLeftStart?: NoneToVoidFunction;
    onSwipeRightStart?: NoneToVoidFunction;
    onCancel: NoneToVoidFunction;
  },
) {
  return captureEvents(element, {
    excludedClosestSelector: options.excludedClosestSelector,
    selectorToPreventScroll: options.selectorToPreventScroll,
    swipeThreshold: 10,

    onSwipe(e, direction, offsets) {
      if (direction === SwipeDirection.Left) {
        options.onSwipeLeftStart?.();
      } else if (direction === SwipeDirection.Right) {
        options.onSwipeRightStart?.();
      } else {
        return false;
      }

      if (IS_IOS) {
        isSwipeActive = true;
        swipeOffsets = offsets;
      }

      return true;
    },

    onDrag(e, captureEvent, offsets) {
      if (!isSwipeActive) return;

      onDrag?.(offsets);
    },

    onRelease() {
      if (!isSwipeActive) return;

      isSwipeActive = false;

      onRelease?.(options.onCancel);

      onDrag = undefined;
      onRelease = undefined;
    },
  });
}

export function allowSwipeControlForTransition(
  currentSlide: HTMLElement,
  nextSlide: HTMLElement,
  onCancelForTransition: NoneToVoidFunction,
) {
  cancelCurrentReleaseAnimation?.();

  if (!isSwipeActive) return;

  const targetPosition = extractAnimationEndPosition(currentSlide);
  if (!targetPosition) return;

  currentSlide.getAnimations().forEach((a) => a.pause());
  nextSlide.getAnimations().forEach((a) => a.pause());

  currentSlide.style.animationTimingFunction = 'linear';
  nextSlide.style.animationTimingFunction = 'linear';

  let currentDirection: 1 | -1 | undefined;

  requestMeasure(() => {
    const computedStyle = getComputedStyle(currentSlide);
    const initialPositionPx = extractPositionFromMatrix(computedStyle.transform, targetPosition.axis);
    const targetPositionPx = targetPosition.units === 'px'
      ? targetPosition.value
      : ((targetPosition.value / 100) * (
        targetPosition.axis === 'X' ? currentSlide.offsetWidth : currentSlide.offsetHeight
      ));
    const distance = targetPositionPx - initialPositionPx;

    let progress = 0;

    onDrag = ({ dragOffsetX, dragOffsetY }) => {
      const dragOffset = targetPosition.axis === 'X'
        ? dragOffsetX - swipeOffsets!.dragOffsetX
        : dragOffsetY - swipeOffsets!.dragOffsetY;

      const newProgress = clamp(dragOffset / distance, 0, 1);
      currentDirection = newProgress > progress ? 1 : -1;
      progress = newProgress;

      updateAnimationProgress([currentSlide, nextSlide], progress);
    };

    onRelease = (onCancelForClient: NoneToVoidFunction) => {
      const isRevertSwipe = currentDirection === -1;

      function cleanup() {
        currentSlide.getAnimations().forEach((a) => a.cancel());
        nextSlide.getAnimations().forEach((a) => a.cancel());

        requestMutation(() => {
          currentSlide.style.animationTimingFunction = '';
          nextSlide.style.animationTimingFunction = '';
        });
      }

      if (!isRevertSwipe) {
        // For some reason animations are not cleared when CSS class is removed
        waitForAnimationEnd(currentSlide, cleanup);
      }

      cancelCurrentReleaseAnimation = animateNumber({
        from: progress,
        to: isRevertSwipe ? 0 : 1,
        duration: INERTIA_DURATION,
        timing: INERTIA_EASING,
        onUpdate(releaseProgress) {
          updateAnimationProgress([currentSlide, nextSlide], releaseProgress);
        },
        onEnd(isCanceled = false) {
          cancelCurrentReleaseAnimation = undefined;

          if (isCanceled || isRevertSwipe) {
            cleanup();
            onCancelForTransition();
            onCancelForClient();
          }
        },
      });
    };
  });
}

function updateAnimationProgress(elements: HTMLElement[], progress: number) {
  elements.map((e) => e.getAnimations()).flat().forEach((animation) => {
    animation.currentTime = (animation.effect!.getTiming().duration as number) * progress;
  });
}

function extractAnimationEndPosition(element: HTMLElement) {
  for (const animation of element.getAnimations()) {
    if (!(animation.effect instanceof KeyframeEffect)) continue;

    for (const keyframe of animation.effect.getKeyframes()) {
      if (keyframe.offset !== 1 || !keyframe.transform) continue;

      const position = extractPositionFromTransform(keyframe.transform as string);
      if (position) {
        return position;
      }
    }
  }

  return undefined;
}

function extractPositionFromTransform(transformRule: string) {
  const match = transformRule.match(/([XY])\((-?\d+)(%|px)\)/);
  if (!match) return undefined;

  return {
    axis: match[1] as 'X' | 'Y',
    value: Number(match[2]),
    units: match[3],
  };
}

function extractPositionFromMatrix(transform: string, axis: 'X' | 'Y') {
  const matrix = transform.slice(7, -1).split(',').map(Number);
  return matrix[axis === 'X' ? 4 : 5];
}
