import { type ElementRef, useEffect } from '../../../lib/teact/teact';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import { animate } from '../../../util/animation';
import { clamp, round } from '../../../util/math';

type Spring = {
  value: number;
  target: number;
  velocity: number;
};

// The springs advance in 60 Hz steps so their speed stays the same on faster displays
const FRAME_MS = 1000 / 60;
// Caps the catch-up after an inactive tab resumes
const MAX_CATCH_UP_MS = 100;

// A stronger spring keeps the card close to the pointer, a softer one lets it drift back after release
const FOLLOW_STIFFNESS = 0.066;
const FOLLOW_DAMPING = 0.25;
const RELEASE_STIFFNESS = 0.01;
const RELEASE_DAMPING = 0.06;

const REST_THRESHOLD = 0.0002;
const STYLE_PRECISION = 4;

// Drives `--tilt-x`/`--tilt-y` in [-1, 1] and `--card-glow` in [0, 1] through springs
export default function useCardTilt(ref: ElementRef<HTMLElement>) {
  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const tiltX = createSpring();
    const tiltY = createSpring();
    const glow = createSpring();
    const springs = [tiltX, tiltY, glow];

    let isCancelled = false;
    let isFollowing = false;
    let isAnimating = false;
    let lastFrameAt = 0;
    let leftoverMs = 0;

    function render() {
      if (isCancelled) return;

      element!.style.setProperty('--tilt-x', String(round(tiltX.value, STYLE_PRECISION)));
      element!.style.setProperty('--tilt-y', String(round(tiltY.value, STYLE_PRECISION)));
      element!.style.setProperty('--card-glow', String(round(glow.value, STYLE_PRECISION)));
    }

    function tick() {
      if (isCancelled) {
        isAnimating = false;

        return false;
      }

      const now = performance.now();
      const elapsed = Math.min(now - lastFrameAt, MAX_CATCH_UP_MS) + leftoverMs;
      lastFrameAt = now;

      const steps = Math.floor(elapsed / FRAME_MS);
      leftoverMs = elapsed - steps * FRAME_MS;

      const stiffness = isFollowing ? FOLLOW_STIFFNESS : RELEASE_STIFFNESS;
      const damping = isFollowing ? FOLLOW_DAMPING : RELEASE_DAMPING;

      for (let i = 0; i < steps; i++) {
        springs.forEach((spring) => stepSpring(spring, stiffness, damping));
      }

      const isAtRest = springs.every(isSpringAtRest);

      if (isAtRest) {
        springs.forEach(settleSpring);
        isAnimating = false;
      }

      // `animate` runs in the measure phase, so the style writes go to the mutation phase of the same frame
      requestMutation(render);

      return !isAtRest;
    }

    function startAnimation() {
      if (isAnimating) return;

      isAnimating = true;
      lastFrameAt = performance.now();
      leftoverMs = 0;
      animate(tick, requestMeasure);
    }

    const handleMove = (e: PointerEvent) => {
      const { left, top, width, height } = element.getBoundingClientRect();

      isFollowing = true;
      tiltX.target = clamp(((e.clientX - left) / width - 0.5) * 2, -1, 1);
      tiltY.target = clamp(((e.clientY - top) / height - 0.5) * 2, -1, 1);
      glow.target = 1;
      startAnimation();
    };

    const handleRelease = () => {
      isFollowing = false;

      springs.forEach((spring) => {
        spring.target = 0;
      });

      startAnimation();
    };

    // A tap tilts on `pointerdown`, since a touch has no hover moves; a scroll fires `pointercancel`
    element.addEventListener('pointerdown', handleMove);
    element.addEventListener('pointermove', handleMove);
    element.addEventListener('pointerleave', handleRelease);
    element.addEventListener('pointercancel', handleRelease);

    return () => {
      isCancelled = true;
      element.removeEventListener('pointerdown', handleMove);
      element.removeEventListener('pointermove', handleMove);
      element.removeEventListener('pointerleave', handleRelease);
      element.removeEventListener('pointercancel', handleRelease);
    };
  }, [ref]);
}

function createSpring(): Spring {
  return { value: 0, target: 0, velocity: 0 };
}

function stepSpring(spring: Spring, stiffness: number, damping: number) {
  spring.velocity = (spring.velocity + (spring.target - spring.value) * stiffness) * (1 - damping);
  spring.value += spring.velocity;
}

function isSpringAtRest(spring: Spring) {
  return Math.abs(spring.target - spring.value) <= REST_THRESHOLD && Math.abs(spring.velocity) <= REST_THRESHOLD;
}

function settleSpring(spring: Spring) {
  spring.value = spring.target;
  spring.velocity = 0;
}
