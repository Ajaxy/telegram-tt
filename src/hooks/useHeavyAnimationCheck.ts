import {
  useCallback, useEffect, useMemo, useRef,
} from '../lib/teact/teact';

import { createCallbackManager } from '../util/callbacks';
import useLastCallback from './useLastCallback';

// Make sure to end even if end callback was not called (which was some hardly-reproducible bug)
const AUTO_END_TIMEOUT = 1000;

const startCallbacks = createCallbackManager();
const endCallbacks = createCallbackManager();

let timeout: number | undefined;
let isAnimating = false;

const useHeavyAnimationCheck = (
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

    if (isAnimating) {
      lastOnStart();
    }

    startCallbacks.addCallback(lastOnStart);
    endCallbacks.addCallback(lastOnEnd);

    return () => {
      endCallbacks.removeCallback(lastOnEnd);
      startCallbacks.removeCallback(lastOnStart);
    };
  }, [isDisabled, lastOnEnd, lastOnStart]);
};

export function useThrottleForHeavyAnimation<T extends AnyToVoidFunction>(afterHeavyAnimation: T, deps: unknown[]) {
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  const fnMemo = useCallback(afterHeavyAnimation, deps);

  const isScheduledRef = useRef(false);

  return useMemo(() => {
    return (...args: Parameters<T>) => {
      if (!isScheduledRef.current) {
        if (!isAnimating) {
          fnMemo(...args);
          return;
        }

        isScheduledRef.current = true;

        const removeCallback = endCallbacks.addCallback(() => {
          fnMemo(...args);
          removeCallback();
          isScheduledRef.current = false;
        });
      }
    };
  }, [fnMemo]);
}

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
