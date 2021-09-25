import { RefObject } from 'react';
import {
  useEffect, useRef, useCallback, useState,
} from '../lib/teact/teact';

import { throttle, debounce } from '../util/schedulers';
import useHeavyAnimationCheck from './useHeavyAnimationCheck';

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

const AUTO_UNFREEZE_TIMEOUT = 2000;

export function useIntersectionObserver({
  rootRef,
  throttleMs,
  debounceMs,
  shouldSkipFirst,
  margin,
  threshold,
  isDisabled,
  isAutoUnfreezeDisabled = false,
}: {
  rootRef: RefObject<HTMLDivElement>;
  throttleMs?: number;
  debounceMs?: number;
  shouldSkipFirst?: boolean;
  margin?: number;
  threshold?: number | number[];
  isDisabled?: boolean;
  isAutoUnfreezeDisabled?: boolean;
}, rootCallback?: RootCallback): Response {
  const controllerRef = useRef<IntersectionController>();
  const rootCallbackRef = useRef<RootCallback>();
  const freezeFlagsRef = useRef(0);
  const autoUnfreezeTimeoutRef = useRef<number>();
  const onUnfreezeRef = useRef<NoneToVoidFunction>();

  rootCallbackRef.current = rootCallback;

  const unfreeze = useCallback(() => {
    if (!freezeFlagsRef.current) {
      return;
    }

    freezeFlagsRef.current--;

    if (!freezeFlagsRef.current && onUnfreezeRef.current) {
      onUnfreezeRef.current();
      onUnfreezeRef.current = undefined;
    }
  }, []);

  const freeze = useCallback(() => {
    freezeFlagsRef.current++;

    if (isAutoUnfreezeDisabled) {
      return;
    }

    if (autoUnfreezeTimeoutRef.current) {
      clearTimeout(autoUnfreezeTimeoutRef.current);
      autoUnfreezeTimeoutRef.current = undefined;
    }

    // Make sure to unfreeze even if unfreeze callback was not called (which was some hardly-reproducible bug)
    autoUnfreezeTimeoutRef.current = window.setTimeout(() => {
      autoUnfreezeTimeoutRef.current = undefined;

      if (!freezeFlagsRef.current) {
        return;
      }

      freezeFlagsRef.current = 1;
      unfreeze();
    }, AUTO_UNFREEZE_TIMEOUT);
  }, [isAutoUnfreezeDisabled, unfreeze]);

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
    const observerCallbackSync = () => {
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
    };
    const scheduler = throttleMs ? throttle : debounceMs ? debounce : undefined;
    const observerCallback = scheduler
      ? scheduler(observerCallbackSync, (throttleMs || debounceMs)!, !shouldSkipFirst)
      : observerCallbackSync;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entriesAccumulator.set(entry.target, entry);
        });

        if (freezeFlagsRef.current) {
          onUnfreezeRef.current = () => {
            observerCallback();
          };
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

  const observe = useCallback((target, targetCallback) => {
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
    // Arguments should never change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDisabled]);

  return { observe, freeze, unfreeze };
}

export function useOnIntersect(
  targetRef: RefObject<HTMLDivElement>, observe?: ObserveFn, callback?: TargetCallback,
) {
  useEffect(() => {
    return observe ? observe(targetRef.current!, callback) : undefined;
    // Arguments should never change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
