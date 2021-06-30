type Scheduler =
  typeof requestAnimationFrame
  | typeof onTickEnd
  | typeof runNow;

export function debounce<F extends AnyToVoidFunction>(
  fn: F,
  ms: number,
  shouldRunFirst = true,
  shouldRunLast = true,
) {
  let waitingTimeout: number | undefined;

  return (...args: Parameters<F>) => {
    if (waitingTimeout) {
      clearTimeout(waitingTimeout);
      waitingTimeout = undefined;
    } else if (shouldRunFirst) {
      // @ts-ignore
      fn(...args);
    }

    // eslint-disable-next-line no-restricted-globals
    waitingTimeout = self.setTimeout(() => {
      if (shouldRunLast) {
        // @ts-ignore
        fn(...args);
      }

      waitingTimeout = undefined;
    }, ms);
  };
}

export function throttle<F extends AnyToVoidFunction>(
  fn: F,
  ms: number,
  shouldRunFirst = true,
) {
  let interval: number | undefined;
  let isPending: boolean;
  let args: Parameters<F>;

  return (..._args: Parameters<F>) => {
    isPending = true;
    args = _args;

    if (!interval) {
      if (shouldRunFirst) {
        isPending = false;
        // @ts-ignore
        fn(...args);
      }

      // eslint-disable-next-line no-restricted-globals
      interval = self.setInterval(() => {
        if (!isPending) {
          // eslint-disable-next-line no-restricted-globals
          self.clearInterval(interval!);
          interval = undefined;
          return;
        }

        isPending = false;
        // @ts-ignore
        fn(...args);
      }, ms);
    }
  };
}

export function throttleWithRaf<F extends AnyToVoidFunction>(fn: F) {
  return throttleWith(fastRaf, fn);
}

export function throttleWithPrimaryRaf<F extends AnyToVoidFunction>(fn: F) {
  return throttleWith(fastPrimaryRaf, fn);
}

export function throttleWithTickEnd<F extends AnyToVoidFunction>(fn: F) {
  return throttleWith(onTickEnd, fn);
}

export function throttleWithNow<F extends AnyToVoidFunction>(fn: F) {
  return throttleWith(runNow, fn);
}

export function throttleWith<F extends AnyToVoidFunction>(schedulerFn: Scheduler, fn: F) {
  let waiting = false;
  let args: Parameters<F>;

  return (..._args: Parameters<F>) => {
    args = _args;

    if (!waiting) {
      waiting = true;

      schedulerFn(() => {
        waiting = false;
        // @ts-ignore
        fn(...args);
      });
    }
  };
}

export function onTickEnd(cb: NoneToVoidFunction) {
  Promise.resolve().then(cb);
}

export function onIdle(cb: NoneToVoidFunction) {
  // eslint-disable-next-line no-restricted-globals
  if (self.requestIdleCallback) {
    // eslint-disable-next-line no-restricted-globals
    self.requestIdleCallback(cb);
  } else {
    onTickEnd(cb);
  }
}

function runNow(fn: NoneToVoidFunction) {
  fn();
}

export const pause = (ms: number) => new Promise((resolve) => {
  setTimeout(() => resolve(), ms);
});

export function rafPromise() {
  return new Promise((resolve) => {
    fastRaf(resolve);
  });
}

let fastRafCallbacks: NoneToVoidFunction[] | undefined;
let fastRafPrimaryCallbacks: NoneToVoidFunction[] | undefined;

// May result in an immediate execution if called from another `requestAnimationFrame` callback
export function fastRaf(callback: NoneToVoidFunction, isPrimary = false) {
  if (!fastRafCallbacks) {
    fastRafCallbacks = isPrimary ? [] : [callback];
    fastRafPrimaryCallbacks = isPrimary ? [callback] : [];

    requestAnimationFrame(() => {
      const currentCallbacks = fastRafCallbacks!;
      const currentPrimaryCallbacks = fastRafPrimaryCallbacks!;
      fastRafCallbacks = undefined;
      fastRafPrimaryCallbacks = undefined;
      currentPrimaryCallbacks.forEach((cb) => cb());
      currentCallbacks.forEach((cb) => cb());
    });
  } else if (isPrimary) {
    fastRafPrimaryCallbacks!.push(callback);
  } else {
    fastRafCallbacks.push(callback);
  }
}

export function fastPrimaryRaf(callback: NoneToVoidFunction) {
  fastRaf(callback, true);
}

let beforeUnloadCallbacks: NoneToVoidFunction[] | undefined;

export function onBeforeUnload(callback: NoneToVoidFunction, isLast = false) {
  if (!beforeUnloadCallbacks) {
    beforeUnloadCallbacks = [];
    // eslint-disable-next-line no-restricted-globals
    self.addEventListener('beforeunload', () => {
      beforeUnloadCallbacks!.forEach((cb) => cb());
    });
  }

  if (isLast) {
    beforeUnloadCallbacks.push(callback);
  } else {
    beforeUnloadCallbacks.unshift(callback);
  }

  return () => {
    beforeUnloadCallbacks = beforeUnloadCallbacks!.filter((cb) => cb !== callback);
  };
}
