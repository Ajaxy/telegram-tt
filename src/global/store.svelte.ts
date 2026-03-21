import { INITIAL_GLOBAL_STATE } from './initialState';
import type { GlobalState } from './types';

import { cloneDeep } from '../util/iteratees';

// Svelte 5 logic for global state
class GlobalStore {
  state = $state<GlobalState>(cloneDeep(INITIAL_GLOBAL_STATE));

  get current() {
    return this.state;
  }

  update(updater: (state: GlobalState) => Partial<GlobalState> | void) {
    const patch = updater(this.state);
    if (patch) {
      Object.assign(this.state, patch);
    }
  }

  set(newState: GlobalState) {
    this.state = newState;
  }
}

export const globalStore = new GlobalStore();

// Legacy compatibility layer to make migration easier
export const getGlobal = () => globalStore.state;
export const setGlobal = (patch: Partial<GlobalState>) => {
  globalStore.update(() => patch);
};
