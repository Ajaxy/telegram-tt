import { getActions } from '.';
import { addCallback, getGlobal } from '../lib/teact/teactn';
import type { GlobalState } from './types';

let previousGlobal = getGlobal();
// RAF can be unreliable when device goes into sleep mode, so sync logic is handled outside any component
addCallback((global: GlobalState) => {
  const { connectionState, authState } = global;
  if (previousGlobal.connectionState === connectionState && previousGlobal.authState === authState) return;
  if (connectionState === 'connectionStateReady' && authState === 'authorizationStateReady') {
    getActions().sync();
  }

  previousGlobal = global;
});
