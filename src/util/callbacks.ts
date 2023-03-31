export function createCallbackManager() {
  const callbacks = new Set<AnyToVoidFunction>();

  function addCallback(cb: AnyToVoidFunction) {
    callbacks.add(cb);

    return () => {
      removeCallback(cb);
    };
  }

  function removeCallback(cb: AnyToVoidFunction) {
    callbacks.delete(cb);
  }

  function runCallbacks(...args: any[]) {
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

export type CallbackManager = ReturnType<typeof createCallbackManager>;
