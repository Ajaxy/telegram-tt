import { useEffect } from '../lib/teact/teact';
import { createCallbackManager } from '../util/callbacks';

const startCallbacks = createCallbackManager();
const endCallbacks = createCallbackManager();

let timeout: number | undefined;
let isActive = false;

const usePriorityPlaybackCheck = (
  handleAnimationStart: AnyToVoidFunction,
  handleAnimationEnd: AnyToVoidFunction,
  isDisabled = false,
) => {
  useEffect(() => {
    if (isDisabled) {
      return undefined;
    }

    if (isActive) {
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

export function isPriorityPlaybackActive() {
  return isActive;
}

export function dispatchPriorityPlaybackEvent() {
  if (!isActive) {
    isActive = true;
    startCallbacks.runCallbacks();
  }

  if (timeout) {
    clearTimeout(timeout);
    timeout = undefined;
  }

  // Race condition may happen if another `dispatchPriorityPlaybackEvent` is called before `onEnd`
  function onEnd() {
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }

    isActive = false;
    endCallbacks.runCallbacks();
  }

  return onEnd;
}

export default usePriorityPlaybackCheck;
