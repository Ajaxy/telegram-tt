import type { GlobalState } from '../global/types';
import type { Signal, SignalSetter } from '../util/signals';

import { getGlobal } from '../global';
import { createSignal } from '../util/signals';

import useEffectOnce from './useEffectOnce';
import { addCallback } from '../lib/teact/teactn';

/*
  This hook is a more performant variation of the standard React `useSelector` hook. It allows to:
  a) Avoid multiple subscriptions to global updates by leveraging a single selector reference.
  b) Return a signal instead of forcing a component update right away.
 */

type Selector<T extends any> = (global: GlobalState) => T;

interface State<T extends any> {
  clientsCount: number;
  getter: Signal<T>;
  setter: SignalSetter;
}

const bySelector = new Map<Selector<any>, State<any>>();

addCallback((global: GlobalState) => {
  for (const [selector, { setter }] of bySelector) {
    setter(selector(global));
  }
});

function useSelectorSignal<T extends any>(selector: Selector<T>): Signal<T> {
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

  return state.getter;
}

export default useSelectorSignal;
