import type { SharedState } from '../types';
import type { WorkerBoundMessageEvent } from './sharedStateConnector';

import { deepFreeze } from '../../util/data/freeze';
import { deepDiff, type DiffObject } from '../../util/deepDiff';
import { deepMerge } from '../../util/deepMerge';

declare const self: SharedWorkerGlobalScope;

interface StateUpdateEvent {
  type: 'stateUpdate';
  update: DiffObject<SharedState>;
}

interface FullStateEvent {
  type: 'fullState';
  state: SharedState;
}

export type ClientBoundMessageEvent = StateUpdateEvent | FullStateEvent;

let state: SharedState | undefined;

const ports: MessagePort[] = [];

self.onconnect = (e: MessageEvent) => {
  const port = e.ports[0];
  ports.push(port);
  port.start();

  port.onmessage = (event: MessageEvent<WorkerBoundMessageEvent>) => {
    const data = event.data;
    switch (data.type) {
      case 'reqGetFullState': {
        const localState = data.localState;
        if (!state) {
          // First tab to load, use this state as the source of truth.
          state = localState;
        }
        sendToClient(port, { type: 'fullState', state });
        break;
      }

      case 'reqUpdateState': {
        if (!state) return; // Client should request full state first
        const prevState = state;
        state = deepMerge(state, data.update as SharedState);
        state.isInitial = undefined; // Remove the flag

        const diff = deepDiff(prevState, state);
        if (typeof diff !== 'symbol') {
          broadcast({ type: 'stateUpdate', update: diff }, port);
        }
        break;
      }
    }
  };
};

function sendToClient(port: MessagePort, message: ClientBoundMessageEvent) {
  port.postMessage(message);
}

function broadcast(message: ClientBoundMessageEvent, ignorePort?: MessagePort) {
  // Iterate backwards to safely remove ports if needed.
  for (let i = ports.length - 1; i >= 0; i--) {
    if (ports[i] === ignorePort) { // Prevent infinite loopback
      continue;
    }

    try {
      sendToClient(ports[i], message);
    } catch (e) {
      ports.splice(i, 1);
    }
  }
}

// DEBUG
(self as any).getState = () => deepFreeze(state);
