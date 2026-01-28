import { useEffect, useState } from '../lib/teact/teact';

export type ComponentImpl<P = any, R = any> = (props: P) => R;

const registry = new Map<string, ComponentImpl>();
const subscribers = new Map<string, Set<() => void>>();

function subscribe(id: string, cb: () => void) {
  let set = subscribers.get(id);
  if (!set) {
    set = new Set();
    subscribers.set(id, set);
  }
  set.add(cb);
  return () => {
    // set is defined because we ensured it above
    const current = subscribers.get(id);
    current?.delete(cb);
  };
}

function notify(id: string) {
  const set = subscribers.get(id);
  if (set) {
    set.forEach((cb) => cb());
  }
}

export function hot<P>(id: string, impl: ComponentImpl<P>): ComponentImpl<P> {
  if (process.env.APP_ENV !== 'production') {
    registry.set(id, impl);

    // Stable wrapper component that re-renders on replace(id, ...)
    const Wrapper = (props: P) => {
      const [, force] = useState(0);
      useEffect(() => subscribe(id, () => force((v) => v + 1)), []);

      const Current = registry.get(id) as ComponentImpl<P>;
      try {
        return Current(props);
      } catch (error) {
        // During HMR transitions, props might be in an inconsistent state
        // Log the error for debugging but don't crash the app
        console.warn(`HMR: Component ${id} failed to render during hot reload:`, error);
        return impl;
      }
    };

    return Wrapper as ComponentImpl<P>;
  }

  return impl;
}

export function replace<P>(id: string, impl: ComponentImpl<P>) {
  if (process.env.APP_ENV !== 'production') {
    registry.set(id, impl);
    notify(id);
  }
}

export function hotModule<P>(
  mod: any,
  id: string,
  impl: ComponentImpl<P>,
): ComponentImpl<P> {
  const wrapped = hot<P>(id, impl);

  if (process.env.APP_ENV !== 'production') {
    // When this module is re-evaluated by HMR, update the registry immediately
    replace<P>(id, impl);

    // Self-accept so HMR stops here without bubbling
    if (mod && mod.hot) {
      mod.hot.accept();
    }
  }

  return wrapped;
}
