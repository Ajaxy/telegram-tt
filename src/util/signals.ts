import type { CallbackManager } from './callbacks';

import { createCallbackManager } from './callbacks';

interface SignalState<T> {
  value: T;
  effects: CallbackManager;
}

const SIGNAL_MARK = Symbol('SIGNAL_MARK');

export type Signal<T = any> = ((() => T) & {
  readonly [SIGNAL_MARK]: symbol;
  subscribe: (cb: AnyToVoidFunction) => NoneToVoidFunction;
  once: (cb: AnyToVoidFunction) => NoneToVoidFunction;
});

export type SignalSetter = (newValue: any) => void;

export function isSignal(obj: any): obj is Signal {
  return typeof obj === 'function' && SIGNAL_MARK in obj;
}

// A shorthand to unsubscribe effect from all signals
const unsubscribesByEffect = new Map<NoneToVoidFunction, Set<NoneToVoidFunction>>();

let currentEffect: NoneToVoidFunction | undefined;

export function createSignal<T>(defaultValue?: T) {
  const state: SignalState<typeof defaultValue> = {
    value: defaultValue,
    effects: createCallbackManager(),
  };

  function subscribe(effect: NoneToVoidFunction) {
    const unsubscribe = state.effects.addCallback(effect);

    if (!unsubscribesByEffect.has(effect)) {
      unsubscribesByEffect.set(effect, new Set([unsubscribe]));
    } else {
      unsubscribesByEffect.get(effect)!.add(unsubscribe);
    }

    return () => {
      unsubscribe();

      const unsubscribes = unsubscribesByEffect.get(effect)!;
      unsubscribes.delete(unsubscribe);
      if (!unsubscribes.size) {
        unsubscribesByEffect.delete(effect);
      }
    };
  }

  function once(effect: NoneToVoidFunction) {
    const unsub = subscribe(() => {
      unsub();
      effect();
    });

    return unsub;
  }

  function getter() {
    if (currentEffect) {
      subscribe(currentEffect);
    }

    return state.value;
  }

  function setter(newValue: T) {
    if (state.value === newValue) {
      return;
    }

    state.value = newValue;
    state.effects.runCallbacks();
  }

  const signal = Object.assign(getter as Signal<T>, {
    [SIGNAL_MARK]: SIGNAL_MARK,
    subscribe,
    once,
  });

  return [signal, setter] as const;
}

export function cleanupEffect(effect: NoneToVoidFunction) {
  unsubscribesByEffect.get(effect)?.forEach((unsubscribe) => {
    unsubscribe();
  });
  unsubscribesByEffect.delete(effect);
}
