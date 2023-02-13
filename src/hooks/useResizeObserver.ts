import { useEffect } from '../lib/teact/teact';

import type { CallbackManager } from '../util/callbacks';

import { createCallbackManager } from '../util/callbacks';

const elementObserverMap = new Map<HTMLElement, [ResizeObserver, CallbackManager]>();

export default function useResizeObserver(
  ref: React.RefObject<HTMLElement> | undefined,
  onResize: (entry: ResizeObserverEntry) => void,
) {
  useEffect(() => {
    if (!('ResizeObserver' in window) || !ref?.current) {
      return undefined;
    }
    const el = ref.current;
    const callback: ResizeObserverCallback = ([entry]) => {
      // During animation
      if (!(entry.target as HTMLElement).offsetParent) {
        return;
      }

      onResize(entry);
    };

    let [observer, callbackManager] = elementObserverMap.get(el) || [undefined, undefined];
    if (!observer) {
      callbackManager = createCallbackManager();
      observer = new ResizeObserver(callbackManager.runCallbacks);
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
  }, [onResize, ref]);
}
