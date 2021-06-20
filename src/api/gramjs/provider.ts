import {
  OnApiUpdate,
  ApiInitialArgs,
  ApiUpdate,
  ApiOnProgress,
} from '../types';
import { Methods, MethodArgs, MethodResponse } from './methods/types';

import { API_THROTTLE_RESET_UPDATES, API_UPDATE_THROTTLE } from '../../config';
import { throttle, throttleWithTickEnd } from '../../util/schedulers';
import { init as initUpdater } from './updater';
import { init as initAuth } from './methods/auth';
import { init as initChats } from './methods/chats';
import { init as initMessages } from './methods/messages';
import { init as initUsers } from './methods/users';
import { init as initClient } from './methods/client';
import { init as initStickers } from './methods/symbols';
import { init as initManagement } from './methods/management';
import { init as initTwoFaSettings } from './methods/twoFaSettings';
import * as methods from './methods';

let onUpdate: OnApiUpdate;

export async function initApi(_onUpdate: OnApiUpdate, initialArgs: ApiInitialArgs) {
  onUpdate = _onUpdate;

  initUpdater(handleUpdate);
  initAuth(handleUpdate);
  initChats(handleUpdate);
  initMessages(handleUpdate);
  initUsers(handleUpdate);
  initStickers(handleUpdate);
  initManagement(handleUpdate);
  initTwoFaSettings(handleUpdate);

  await initClient(handleUpdate, initialArgs);
}

export function callApi<T extends keyof Methods>(fnName: T, ...args: MethodArgs<T>): MethodResponse<T> {
  // @ts-ignore
  return methods[fnName](...args) as MethodResponse<T>;
}

export function cancelApiProgress(progressCallback: ApiOnProgress) {
  progressCallback.isCanceled = true;
}

const flushUpdatesOnTickEnd = throttleWithTickEnd(flushUpdates);

let flushUpdatesThrottled: typeof flushUpdatesOnTickEnd | undefined;
let currentThrottleId: number | undefined;

let pendingUpdates: ApiUpdate[] | undefined;

function handleUpdate(update: ApiUpdate) {
  if (!pendingUpdates) {
    pendingUpdates = [update];
  } else {
    pendingUpdates.push(update);
  }

  if (!flushUpdatesThrottled || API_THROTTLE_RESET_UPDATES.has(update['@type'])) {
    flushUpdatesThrottled = throttle(flushUpdatesOnTickEnd, API_UPDATE_THROTTLE, true);
    currentThrottleId = Math.random();
  }

  flushUpdatesThrottled(currentThrottleId!);
}

function flushUpdates(throttleId: number) {
  if (!pendingUpdates || throttleId !== currentThrottleId) {
    return;
  }

  const currentUpdates = pendingUpdates!;
  pendingUpdates = undefined;
  currentUpdates.forEach(onUpdate);
}
