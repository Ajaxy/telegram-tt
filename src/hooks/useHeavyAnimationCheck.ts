import {
  useCallback, useEffect, useMemo, useRef,
} from '../lib/teact/teact';

import { requestMeasure } from '../lib/fasterdom/fasterdom';
import { createCallbackManager } from '../util/callbacks';
import { onIdle } from '../util/schedulers';
import { createSignal } from '../util/signals';
import useLastCallback from './useLastCallback';

// Make sure to end even if end callback was not called (which was some hardly-reproducible bug)
const AUTO_END_TIMEOUT = 1000;

const startCallbacks = createCallbackManager();
const endCallbacks = createCallbackManager();

let counter = 0;

const [getIsAnimating, setIsAnimating] = createSignal(false);

export const getIsHeavyAnimating = getIsAnimating;

export default function useHeavyAnimationCheck(
  onStart?: AnyToVoidFunction,
  onEnd?: AnyToVoidFunction,
  isDisabled = false,
) {
  const lastOnStart = useLastCallback(onStart);
  const lastOnEnd = useLastCallback(onEnd);

  useEffect(() => {
    if (isDisabled) {
      return undefined;
    }

    if (getIsAnimating()) {
      lastOnStart();
    }

    startCallbacks.addCallback(lastOnStart);
    endCallbacks.addCallback(lastOnEnd);

    return () => {
      endCallbacks.removeCallback(lastOnEnd);
      startCallbacks.removeCallback(lastOnStart);
    };
  }, [isDisabled, lastOnEnd, lastOnStart]);
}

// TODO → `onFullyIdle`?
export function useThrottleForHeavyAnimation<T extends AnyToVoidFunction>(afterHeavyAnimation: T, deps: unknown[]) {
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  const fnMemo = useCallback(afterHeavyAnimation, deps);

  const isScheduledRef = useRef(false);

  return useMemo(() => {
    return (...args: Parameters<T>) => {
      if (!isScheduledRef.current) {
        if (!getIsAnimating()) {
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
  return getIsAnimating();
}

export function dispatchHeavyAnimationEvent(duration = AUTO_END_TIMEOUT) {
  counter++;

  if (counter === 1) {
    setIsAnimating(true);
    startCallbacks.runCallbacks();
  }

  const timeout = window.setTimeout(onEnd, duration);

  let hasEnded = false;

  function onEnd() {
    if (hasEnded) return;
    hasEnded = true;

    clearTimeout(timeout);

    counter--;

    if (counter === 0) {
      setIsAnimating(false);
      endCallbacks.runCallbacks();
    }
  }

  return onEnd;
}

export function onFullyIdle(cb: NoneToVoidFunction) {
  onIdle(() => {
    if (getIsAnimating()) {
      requestMeasure(() => {
        onFullyIdle(cb);
      });
    } else {
      cb();
    }
  });
}
