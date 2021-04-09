import { useEffect } from '../lib/teact/teact';

const ANIMATION_START_EVENT = 'tt-event-heavy-animation-start';
const ANIMATION_END_EVENT = 'tt-event-heavy-animation-end';

let timeout: number | undefined;
let isAnimating = false;

export const dispatchHeavyAnimationEvent = (duration: number) => {
  document.dispatchEvent(new Event(ANIMATION_START_EVENT));
  isAnimating = true;

  if (timeout) {
    clearTimeout(timeout);
    timeout = undefined;
  }

  timeout = window.setTimeout(() => {
    isAnimating = false;
    document.dispatchEvent(new Event(ANIMATION_END_EVENT));
    timeout = undefined;
  }, duration);
};

export default (
  handleAnimationStart: AnyToVoidFunction,
  handleAnimationEnd: AnyToVoidFunction,
) => {
  useEffect(() => {
    if (isAnimating) {
      handleAnimationStart();
    }

    document.addEventListener(ANIMATION_START_EVENT, handleAnimationStart);
    document.addEventListener(ANIMATION_END_EVENT, handleAnimationEnd);

    return () => {
      document.removeEventListener(ANIMATION_END_EVENT, handleAnimationEnd);
      document.removeEventListener(ANIMATION_START_EVENT, handleAnimationStart);
    };
  }, [handleAnimationEnd, handleAnimationStart]);
};
