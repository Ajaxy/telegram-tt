import { useEffect } from '../lib/teact/teact';

import type { CallbackManager } from '../util/callbacks';

import { createCallbackManager } from '../util/callbacks';
import { useStateRef } from './useStateRef';

const elementObserverMap = new Map<HTMLElement, [IntersectionObserver, CallbackManager]>();

export default function useSharedIntersectionObserver(
  refOrElement: React.RefObject<HTMLElement> | HTMLElement | undefined,
  onIntersectionChange: (entry: IntersectionObserverEntry) => void,
  isDisabled = false,
) {
  const onIntersectionChangeRef = useStateRef(onIntersectionChange);

  useEffect(() => {
    const el = refOrElement && 'current' in refOrElement ? refOrElement.current : refOrElement;
    if (!el || isDisabled) {
      return undefined;
    }

    const callback: IntersectionObserverCallback = ([entry]) => {
      // Ignore updates when element is not properly mounted (`display: none`)
      if (!(entry.target as HTMLElement).offsetWidth || !(entry.target as HTMLElement).offsetHeight) {
        return;
      }

      onIntersectionChangeRef.current(entry);
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
  }, [isDisabled, onIntersectionChangeRef, refOrElement]);
}
