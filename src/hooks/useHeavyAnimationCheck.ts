import { useEffect } from '../lib/teact/teact';
import { createCallbackManager } from '../util/callbacks';

// Make sure to end even if end callback was not called (which was some hardly-reproducible bug)
const AUTO_END_TIMEOUT = 1000;

const startCallbacks = createCallbackManager();
const endCallbacks = createCallbackManager();

let timeout: number | undefined;
let isAnimating = false;

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

    startCallbacks.addCallback(handleAnimationStart);
    endCallbacks.addCallback(handleAnimationEnd);

    return () => {
      endCallbacks.removeCallback(handleAnimationEnd);
      startCallbacks.removeCallback(handleAnimationStart);
    };
  }, [isDisabled, handleAnimationEnd, handleAnimationStart]);
};

export function isHeavyAnimating() {
  return isAnimating;
}

export function dispatchHeavyAnimationEvent(duration = AUTO_END_TIMEOUT) {
  if (!isAnimating) {
    isAnimating = true;
    startCallbacks.runCallbacks();
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
    endCallbacks.runCallbacks();
  }

  timeout = window.setTimeout(onEnd, duration);

  return onEnd;
}

export default useHeavyAnimationCheck;
