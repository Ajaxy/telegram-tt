export function createCallbackManager<T extends AnyToVoidFunction = AnyToVoidFunction>() {
  const callbacks = new Set<T>();

  function addCallback(cb: T) {
    callbacks.add(cb);

    return () => {
      removeCallback(cb);
    };
  }

  function removeCallback(cb: T) {
    callbacks.delete(cb);
  }

  function runCallbacks(...args: Parameters<T>) {
    callbacks.forEach((callback) => {
      callback(...args);
    });
  }

  function hasCallbacks() {
    return Boolean(callbacks.size);
  }

  return {
    runCallbacks,
    addCallback,
    removeCallback,
    hasCallbacks,
  };
}

export type CallbackManager<T extends AnyToVoidFunction = AnyToVoidFunction>
  = ReturnType<typeof createCallbackManager<T>>;
