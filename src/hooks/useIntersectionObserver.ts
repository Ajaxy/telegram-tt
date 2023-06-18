import type { RefObject } from 'react';
import { useEffect, useRef, useState } from '../lib/teact/teact';

import type { Scheduler } from '../util/schedulers';

import {
  throttle, debounce, throttleWith,
} from '../util/schedulers';
import useHeavyAnimationCheck from './useHeavyAnimationCheck';
import useLastCallback from './useLastCallback';

type TargetCallback = (entry: IntersectionObserverEntry) => void;
type RootCallback = (entries: IntersectionObserverEntry[]) => void;
type ObserveCleanup = NoneToVoidFunction;
export type ObserveFn = (target: HTMLElement, targetCallback?: TargetCallback) => ObserveCleanup;

interface IntersectionController {
  observer: IntersectionObserver;
  callbacks: Map<HTMLElement, TargetCallback>;
}

interface Response {
  observe: ObserveFn;
  freeze: NoneToVoidFunction;
  unfreeze: NoneToVoidFunction;
}

export function useIntersectionObserver({
  rootRef,
  throttleMs,
  throttleScheduler,
  debounceMs,
  shouldSkipFirst,
  margin,
  threshold,
  isDisabled,
}: {
  rootRef: RefObject<HTMLDivElement>;
  throttleMs?: number;
  throttleScheduler?: Scheduler;
  debounceMs?: number;
  shouldSkipFirst?: boolean;
  margin?: number;
  threshold?: number | number[];
  isDisabled?: boolean;
}, rootCallback?: RootCallback): Response {
  const controllerRef = useRef<IntersectionController>();
  const rootCallbackRef = useRef<RootCallback>();
  const freezeFlagsRef = useRef(0);
  const onUnfreezeRef = useRef<NoneToVoidFunction>();

  rootCallbackRef.current = rootCallback;

  const freeze = useLastCallback(() => {
    freezeFlagsRef.current++;
  });

  const unfreeze = useLastCallback(() => {
    if (!freezeFlagsRef.current) {
      return;
    }

    freezeFlagsRef.current--;

    if (!freezeFlagsRef.current && onUnfreezeRef.current) {
      onUnfreezeRef.current();
      onUnfreezeRef.current = undefined;
    }
  });

  useHeavyAnimationCheck(freeze, unfreeze);

  useEffect(() => {
    if (isDisabled) {
      return undefined;
    }

    return () => {
      if (controllerRef.current) {
        controllerRef.current.observer.disconnect();
        controllerRef.current.callbacks.clear();
        controllerRef.current = undefined;
      }
    };
  }, [isDisabled]);

  function initController() {
    const callbacks = new Map();
    const entriesAccumulator = new Map<Element, IntersectionObserverEntry>();

    let observerCallback: typeof observerCallbackSync;
    if (typeof throttleScheduler === 'function') {
      observerCallback = throttleWith(throttleScheduler, observerCallbackSync);
    } else if (throttleMs) {
      observerCallback = throttle(observerCallbackSync, throttleMs, !shouldSkipFirst);
    } else if (debounceMs) {
      observerCallback = debounce(observerCallbackSync, debounceMs, !shouldSkipFirst);
    } else {
      observerCallback = observerCallbackSync;
    }

    function observerCallbackSync() {
      if (freezeFlagsRef.current) {
        onUnfreezeRef.current = observerCallback;
        return;
      }

      const entries = Array.from(entriesAccumulator.values());

      entries.forEach((entry: IntersectionObserverEntry) => {
        const callback = callbacks.get(entry.target);
        if (callback) {
          callback!(entry, entries);
        }
      });

      if (rootCallbackRef.current) {
        rootCallbackRef.current(entries);
      }

      entriesAccumulator.clear();
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entriesAccumulator.set(entry.target, entry);
        });

        if (freezeFlagsRef.current) {
          onUnfreezeRef.current = observerCallback;
        } else {
          observerCallback();
        }
      },
      {
        root: rootRef.current,
        rootMargin: margin ? `${margin}px` : undefined,
        threshold,
      },
    );

    controllerRef.current = { observer, callbacks };
  }

  const observe = useLastCallback((target, targetCallback) => {
    if (!controllerRef.current) {
      initController();
    }

    const controller = controllerRef.current!;
    controller.observer.observe(target);

    if (targetCallback) {
      controller.callbacks.set(target, targetCallback);
    }

    return () => {
      if (targetCallback) {
        controller.callbacks.delete(target);
      }

      controller.observer.unobserve(target);
    };
  });

  return { observe, freeze, unfreeze };
}

export function useOnIntersect(
  targetRef: RefObject<HTMLDivElement>, observe?: ObserveFn, callback?: TargetCallback,
) {
  const lastCallback = useLastCallback(callback);

  useEffect(() => {
    return observe ? observe(targetRef.current!, lastCallback) : undefined;
  }, [lastCallback, observe, targetRef]);
}

export function useIsIntersecting(
  targetRef: RefObject<HTMLDivElement>, observe?: ObserveFn, callback?: TargetCallback,
) {
  const [isIntersecting, setIsIntersecting] = useState(!observe);

  useOnIntersect(targetRef, observe, (entry) => {
    setIsIntersecting(entry.isIntersecting);

    if (callback) {
      callback(entry);
    }
  });

  return isIntersecting;
}
