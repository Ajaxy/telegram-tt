import { useEffect } from 'react';

import { createCallbackManager } from '../util/callbacks';
import useLastCallback from './useLastCallback.react';

const startCallbacks = createCallbackManager();
const endCallbacks = createCallbackManager();

let timeout: number | undefined;
let isActive = false;

const usePriorityPlaybackCheck = (
  onStart?: AnyToVoidFunction,
  onEnd?: AnyToVoidFunction,
  isDisabled = false,
) => {
  const lastOnStart = useLastCallback(onStart);
  const lastOnEnd = useLastCallback(onEnd);

  useEffect(() => {
    if (isDisabled) {
      return undefined;
    }

    if (isActive) {
      lastOnStart();
    }

    startCallbacks.addCallback(lastOnStart);
    endCallbacks.addCallback(lastOnEnd);

    return () => {
      endCallbacks.removeCallback(lastOnEnd);
      startCallbacks.removeCallback(lastOnStart);
    };
  }, [isDisabled, lastOnStart, lastOnEnd]);
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
