import { useEffect } from '../lib/teact/teact';

const ANIMATION_START_EVENT = 'tt-event-heavy-animation-start';
const ANIMATION_END_EVENT = 'tt-event-heavy-animation-end';

let timeout: number | undefined;
let isAnimating = false;

// Make sure to end even if end callback was not called (which was some hardly-reproducible bug)
const AUTO_END_TIMEOUT = 1000;

const useHeavyAnimationCheck = (
  handleAnimationStart: AnyToVoidFunction,
  handleAnimationEnd: AnyToVoidFunction,
  isDisabled = false,
) => {
  useEffect(() => {
    if (isDisabled) {
      return undefined;
    }

    if (isAnimating) {
      handleAnimationStart();
    }

    document.addEventListener(ANIMATION_START_EVENT, handleAnimationStart);
    document.addEventListener(ANIMATION_END_EVENT, handleAnimationEnd);

    return () => {
      document.removeEventListener(ANIMATION_END_EVENT, handleAnimationEnd);
      document.removeEventListener(ANIMATION_START_EVENT, handleAnimationStart);
    };
  }, [isDisabled, handleAnimationEnd, handleAnimationStart]);
};

export function isHeavyAnimating() {
  return isAnimating;
}

export function dispatchHeavyAnimationEvent(duration = AUTO_END_TIMEOUT) {
  if (!isAnimating) {
    isAnimating = true;
    document.dispatchEvent(new Event(ANIMATION_START_EVENT));
  }

  if (timeout) {
    clearTimeout(timeout);
    timeout = undefined;
  }

  // Race condition may happen if another `dispatchHeavyAnimationEvent` is called before `onEnd`
  function onEnd() {
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }

    isAnimating = false;
    document.dispatchEvent(new Event(ANIMATION_END_EVENT));
  }

  timeout = window.setTimeout(onEnd, duration);

  return onEnd;
}

export default useHeavyAnimationCheck;
