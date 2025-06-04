import { addCallback } from '../../lib/teact/teactn';
import { getGlobal } from '../../global';

import type { GlobalState } from '../../global/types';
import type { Signal, SignalSetter } from '../../util/signals';

import { createSignal } from '../../util/signals';
import useSyncEffect from '../useSyncEffect';

/*
  This hook is a more performant variation of the standard React `useSelector` hook. It allows to:
  a) Avoid multiple subscriptions to global updates by leveraging a single selector reference.
  b) Return a signal instead of forcing a component update right away.
 */

type Selector<T> = (global: GlobalState) => T;

interface State<T> {
  clientsCount: number;
  getter: Signal<T>;
  setter: SignalSetter<T>;
}

const bySelector = new Map<Selector<unknown>, State<unknown>>();

addCallback((global: GlobalState) => {
  for (const [selector, { setter }] of bySelector) {
    setter(selector(global));
  }
});

function useSelectorSignal<T>(selector: Selector<T>): Signal<T> {
  let state = bySelector.get(selector) as State<T> | undefined;
  if (!state) {
    const [getter, setter] = createSignal(selector(getGlobal()));
    state = { clientsCount: 0, getter, setter };
    bySelector.set(selector, state as State<unknown>);
  }

  useSyncEffect(() => {
    const state2 = bySelector.get(selector)!;

    state2.clientsCount++;

    return () => {
      state2.clientsCount--;

      if (!state2.clientsCount) {
        bySelector.delete(selector);
      }
    };
  }, [selector]);

  return state.getter;
}

export default useSelectorSignal;
