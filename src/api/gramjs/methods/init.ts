import type {
  ApiInitialArgs,
  ApiOnProgress,
  ApiUpdate,
  OnApiUpdate,
} from '../../types';
import type { LocalDb } from '../localDb';
import type { MethodArgs, MethodResponse, Methods } from './types';

import { API_THROTTLE_RESET_UPDATES, API_UPDATE_THROTTLE } from '../../../config';
import { throttle, throttleWithTickEnd } from '../../../util/schedulers';
import { updateFullLocalDb } from '../localDb';
import { init as initUpdater } from '../updates/updater';
import { init as initAuth } from './auth';
import { init as initBots } from './bots';
import { init as initCalls } from './calls';
import { init as initChats } from './chats';
import { init as initClient } from './client';
import * as methods from './index';
import { init as initManagement } from './management';
import { init as initMessages } from './messages';
import { init as initPayments } from './payments';
import { init as initStickers } from './symbols';
import { init as initTwoFaSettings } from './twoFaSettings';
import { init as initUsers } from './users';

let onUpdate: OnApiUpdate;

export function initApi(_onUpdate: OnApiUpdate, initialArgs: ApiInitialArgs, initialLocalDb?: LocalDb) {
  onUpdate = _onUpdate;

  initUpdater(handleUpdate);
  initAuth(handleUpdate);
  initChats(handleUpdate);
  initMessages(handleUpdate);
  initUsers(handleUpdate);
  initStickers(handleUpdate);
  initManagement(handleUpdate);
  initTwoFaSettings(handleUpdate);
  initBots(handleUpdate);
  initCalls(handleUpdate);
  initPayments(handleUpdate);

  if (initialLocalDb) updateFullLocalDb(initialLocalDb);

  initClient(handleUpdate, initialArgs);
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
