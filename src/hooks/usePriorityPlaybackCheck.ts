import { useEffect } from '../lib/teact/teact';

import { createCallbackManager } from '../util/callbacks';
import useLastCallback from './useLastCallback';

const startCallbacks = createCallbackManager();
const endCallbacks = createCallbackManager();

let activeCount = 0;

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

    if (activeCount) {
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
  return activeCount > 0;
}

// Overlapping dispatchers, e.g. the Media Viewer handing over to the Media Editor, keep the playback paused
export function dispatchPriorityPlaybackEvent() {
  activeCount++;
  if (activeCount === 1) {
    startCallbacks.runCallbacks();
  }

  let isEnded = false;
  function onEnd() {
    if (isEnded) return;

    isEnded = true;
    activeCount--;
    if (!activeCount) {
      endCallbacks.runCallbacks();
    }
  }

  return onEnd;
}

export default usePriorityPlaybackCheck;
