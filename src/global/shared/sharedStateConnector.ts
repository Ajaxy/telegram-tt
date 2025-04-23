import { addCallback, removeCallback } from '../../lib/teact/teactn';

import type { SharedState } from '../types';
import type { ClientBoundMessageEvent } from './sharedState.worker';

import { APP_NAME } from '../../config';
import { deepDiff, type DiffObject } from '../../util/deepDiff';
import { deepMerge } from '../../util/deepMerge';
import { throttleWithTickEnd } from '../../util/schedulers';
import { INITIAL_SHARED_STATE } from '../initialState';
import { getGlobal, setGlobal } from '..';

interface GetFullStateEvent {
  type: 'reqGetFullState';
  localState: SharedState;
}

interface UpdateStateEvent {
  type: 'reqUpdateState';
  update: DiffObject<SharedState>;
}

export type WorkerBoundMessageEvent = GetFullStateEvent | UpdateStateEvent;

let sharedWorker: SharedWorker | undefined;

// Tracks if the client has been synced with the shared state.
let synced = false;
let lastSharedState: SharedState = INITIAL_SHARED_STATE;

export function initSharedState(localState: SharedState) {
  sharedWorker = new SharedWorker(new URL('./sharedState.worker.ts', import.meta.url), { name: APP_NAME });

  sharedWorker.port.addEventListener('message', onMessage);
  sharedWorker.port.start();

  sendToWorker({ type: 'reqGetFullState', localState });

  addCallback(onGlobalChange);
}

function onGlobalChange() {
  const global = getGlobal();
  if (global.sharedState === lastSharedState) return;
  if (global.sharedState.isInitial) return;

  updateSharedState(global.sharedState);
}

function onMessage(event: MessageEvent<ClientBoundMessageEvent>) {
  const data = event.data;
  switch (data.type) {
    case 'stateUpdate': {
      const state = deepMerge(lastSharedState, data.update);
      updateGlobal(state);
      break;
    }
    case 'fullState':
      synced = true;
      updateGlobal(data.state);
      break;
  }
}

export function destroySharedStatePort() {
  if (!sharedWorker) return;
  sharedWorker.port.removeEventListener('message', onMessage);
  sharedWorker.port.close();
  sharedWorker = undefined;
  removeCallback(onGlobalChange);
}

function updateSharedState(update: SharedState) {
  if (!synced) return;
  const diff = deepDiff(lastSharedState, update);
  lastSharedState = update;
  if (typeof diff === 'symbol') return;

  sendToWorker({ type: 'reqUpdateState', update: diff });
}

const scheduledEvents = new Set<WorkerBoundMessageEvent>();

const sendOnTickEnd = throttleWithTickEnd(() => {
  if (!sharedWorker) {
    throw new Error('Shared worker not initialized');
  }

  for (const event of scheduledEvents) {
    sharedWorker.port.postMessage(event);
  }
  scheduledEvents.clear();
});

function sendToWorker(event: WorkerBoundMessageEvent) {
  if (!sharedWorker) {
    throw new Error('Shared worker not initialized');
  }

  scheduledEvents.add(event);
  sendOnTickEnd();
}

function updateGlobal(update: Partial<SharedState>) {
  let global = getGlobal();
  lastSharedState = {
    ...global.sharedState,
    ...update,
  };

  global = {
    ...global,
    sharedState: lastSharedState,
  };
  setGlobal(global);
}
