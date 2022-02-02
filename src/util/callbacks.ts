export function createCallbackManager() {
  const callbacks: AnyToVoidFunction[] = [];

  function addCallback(cb: AnyToVoidFunction) {
    callbacks.push(cb);

    return () => {
      removeCallback(cb);
    };
  }

  function removeCallback(cb: AnyToVoidFunction) {
    const index = callbacks.indexOf(cb);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }

  function runCallbacks(...args: any[]) {
    callbacks.forEach((callback) => {
      callback(...args);
    });
  }

  function hasCallbacks() {
    return Boolean(callbacks.length);
  }

  return {
    runCallbacks,
    addCallback,
    removeCallback,
    hasCallbacks,
  };
}

export type CallbackManager = ReturnType<typeof createCallbackManager>;
