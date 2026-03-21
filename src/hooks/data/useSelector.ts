import { useRef, useSignal } from '../../lib/teact/teact';
import { addCallback } from '../../lib/teact/teactn';
import { getGlobal } from '../../global';

import type { GlobalState } from '../../global/types';

import areShallowEqual from '../../util/areShallowEqual';
import { createSignal, type Signal, type SignalSetter } from '../../util/signals';
import useDerivedState from '../useDerivedState';
import useSyncEffect from '../useSyncEffect';

type Selector<T> = (global: GlobalState) => T;
type EqualityFn<T> = (oldValue: T, newValue: T) => boolean;

interface State<T> {
  clientsCount: number;
  getter: Signal<T>;
  setter: SignalSetter<T>;
}

const bySelector = new Map<Selector<unknown>, State<unknown>>();

let currentGlobal = getGlobal();
addCallback((global: GlobalState) => {
  currentGlobal = global;

  for (const [selector, { setter }] of bySelector) {
    setter(selector(global));
  }
});

/**
 * @param selector - A stable or memoized selector function.
 */
export function useSelectorSignal<T>(selector: Selector<T>): Signal<T> {
  let state = bySelector.get(selector) as State<T> | undefined;
  if (!state) {
    const [getter, setter] = createSignal(selector(currentGlobal));
    state = { clientsCount: 0, getter, setter };
    bySelector.set(selector, state as State<unknown>);
  }

  useSyncEffect(() => {
    const currentState = bySelector.get(selector);
    if (!currentState) {
      return undefined;
    }

    currentState.clientsCount++;

    // Refresh if selector changed
    const currentValue = selector(currentGlobal);
    if (currentValue !== currentState.getter()) {
      currentState.setter(currentValue);
    }

    return () => {
      currentState.clientsCount--;

      if (!currentState.clientsCount) {
        bySelector.delete(selector);
      }
    };
  }, [selector]);

  return state.getter;
}

/**
 * @param selector - A stable or memoized selector function.
 */
export function useSelector<T>(selector: Selector<T>) {
  const selectorSignal = useSelectorSignal(selector);
  return useDerivedState(selectorSignal, [selectorSignal, selector]);
}

export function useSelectorSignalWithEquality<T>(
  selector: Selector<T>,
  equalityFn: EqualityFn<T>,
) {
  const baseSignal = useSelectorSignal(selector);
  // Initialize with current value
  const [signal, setSignal] = useSignal(baseSignal());
  const lastValueRef = useRef(signal());

  useSyncEffect(() => {
    const checkForUpdate = () => {
      const newValue = baseSignal();
      if (!equalityFn(lastValueRef.current, newValue)) {
        lastValueRef.current = newValue;
        setSignal(newValue);
      }
    };

    checkForUpdate();

    return baseSignal.subscribe(checkForUpdate);
  }, [baseSignal, equalityFn, setSignal]);

  return signal;
}

export function useSelectorWithEquality<T>(
  selector: Selector<T>,
  equalityFn: EqualityFn<T>,
) {
  const signal = useSelectorSignalWithEquality(selector, equalityFn);
  return useDerivedState(signal);
}

export function useShallowSelectorSignal<T extends AnyLiteral | undefined>(selector: Selector<T>) {
  return useSelectorSignalWithEquality(selector, areShallowEqual);
}

export function useShallowSelector<T extends AnyLiteral | undefined>(selector: Selector<T>) {
  return useSelectorWithEquality(selector, areShallowEqual);
}

export default useSelector;
