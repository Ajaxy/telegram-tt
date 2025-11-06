import {
  getIsHeavyAnimating,
  useCallback, useEffect, useRef,
} from '../lib/teact/teact';

import { createCallbackManager } from '../util/callbacks';
import useLastCallback from './useLastCallback';

export const startCallbacks = createCallbackManager();
export const endCallbacks = createCallbackManager();

getIsHeavyAnimating.subscribe(() => {
  if (getIsHeavyAnimating()) {
    startCallbacks.runCallbacks();
  } else {
    endCallbacks.runCallbacks();
  }
});

export default function useHeavyAnimation(
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

    if (getIsHeavyAnimating()) {
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
  const pendingCallRef = useRef<AnyToVoidFunction>();

  useEffect(() => {
    return () => {
      if (pendingCallRef.current) {
        endCallbacks.removeCallback(pendingCallRef.current);
        pendingCallRef.current = undefined;
      }
    };
  }, [fnMemo]);

  return useCallback((...args: Parameters<T>) => {
    if (pendingCallRef.current) {
      endCallbacks.removeCallback(pendingCallRef.current);
    }

    const wrappedCallback = () => {
      pendingCallRef.current = undefined;
      fnMemo(...args);
    };

    if (getIsHeavyAnimating()) {
      pendingCallRef.current = wrappedCallback;
      endCallbacks.addCallback(wrappedCallback);
    } else {
      wrappedCallback();
    }
  }, [fnMemo]) as T;
}
