import { getIsHeavyAnimating, useEffect } from '../lib/teact/teact';

import type { CallbackManager } from '../util/callbacks';

import { requestMeasure } from '../lib/fasterdom/fasterdom';
import { createCallbackManager } from '../util/callbacks';
import useLastCallback from './useLastCallback';

const elementObserverMap = new Map<HTMLElement, [IntersectionObserver, CallbackManager]>();

export default function useSharedIntersectionObserver(
  refOrElement: React.RefObject<HTMLElement> | HTMLElement | undefined,
  onIntersectionChange: (entry: IntersectionObserverEntry) => void,
  isDisabled = false,
) {
  const onIntersectionChangeLast = useLastCallback(onIntersectionChange);

  useEffect(() => {
    const el = refOrElement && 'current' in refOrElement ? refOrElement.current : refOrElement;
    if (!el || isDisabled) {
      return undefined;
    }

    const entriesAccumulator = new Map<Element, IntersectionObserverEntry>();

    function flush() {
      for (const entry of entriesAccumulator.values()) {
        // Ignore updates when element is not properly mounted (`display: none`)
        if (!(entry.target as HTMLElement).offsetParent) {
          continue;
        }

        onIntersectionChangeLast(entry);
      }

      entriesAccumulator.clear();
    }

    const callback: IntersectionObserverCallback = ([entry]) => {
      entriesAccumulator.set(entry.target, entry);

      if (!getIsHeavyAnimating()) {
        flush();
      } else {
        getIsHeavyAnimating.once(() => {
          requestMeasure(flush);
        });
      }
    };

    let [observer, callbackManager] = elementObserverMap.get(el) || [undefined, undefined];
    if (!observer) {
      callbackManager = createCallbackManager();
      observer = new IntersectionObserver(callbackManager.runCallbacks);
      elementObserverMap.set(el, [observer, callbackManager]);
      observer.observe(el);
    }
    callbackManager!.addCallback(callback);

    return () => {
      callbackManager!.removeCallback(callback);
      if (!callbackManager!.hasCallbacks()) {
        observer!.unobserve(el);
        observer!.disconnect();
        elementObserverMap.delete(el);
      }
    };
  }, [isDisabled, refOrElement]);
}
