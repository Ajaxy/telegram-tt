import type {
  ApiInitialArgs,
  ApiOnProgress,
  OnApiUpdate,
} from '../../types';
import type { LocalDb } from '../localDb';
import type { MethodArgs, MethodResponse, Methods } from './types';

import { updateFullLocalDb } from '../localDb';
import { init as initUpdateEmitter } from '../updates/apiUpdateEmitter';
import { init as initClient } from './client';
import * as methods from './index';

export function initApi(_onUpdate: OnApiUpdate, initialArgs: ApiInitialArgs, initialLocalDb?: LocalDb) {
  initUpdateEmitter(_onUpdate);

  if (initialLocalDb) updateFullLocalDb(initialLocalDb);

  initClient(initialArgs);
}

export function callApi<T extends keyof Methods>(fnName: T, ...args: MethodArgs<T>): MethodResponse<T> {
  // @ts-ignore
  return methods[fnName](...args) as MethodResponse<T>;
}

export function cancelApiProgress(progressCallback: ApiOnProgress) {
  progressCallback.isCanceled = true;
}
