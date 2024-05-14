import { addCallback } from '../lib/teact/teactn';
import { getGlobal } from '../global';

import type { GlobalState } from '../global/types';
import type { Signal, SignalSetter } from '../util/signals';

import { createSignal } from '../util/signals';
import useEffectOnce from './useEffectOnce';

/*
  This hook is a more performant variation of the standard React `useSelector` hook. It allows to:
  a) Avoid multiple subscriptions to global updates by leveraging a single selector reference.
  b) Return a signal instead of forcing a component update right away.
 */

type Selector<T extends unknown> = (global: GlobalState) => T;

interface State<T extends unknown> {
  clientsCount: number;
  getter: Signal<T>;
  setter: SignalSetter;
}

const bySelector = new Map<Selector<unknown>, State<unknown>>();

addCallback((global: GlobalState) => {
  for (const [selector, { setter }] of bySelector) {
    setter(selector(global));
  }
});

function useSelectorSignal<T extends unknown>(selector: Selector<T>): Signal<T> {
  let state = bySelector.get(selector);

  if (!state) {
    const [getter, setter] = createSignal(selector(getGlobal()));
    state = { clientsCount: 0, getter, setter };
    bySelector.set(selector, state);
  }

  useEffectOnce(() => {
    state!.clientsCount++;

    return () => {
      state!.clientsCount--;

      if (!state!.clientsCount) {
        bySelector.delete(selector);
      }
    };
  });

  return state.getter as Signal<T>;
}

export default useSelectorSignal;
