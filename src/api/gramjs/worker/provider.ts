import type { Api } from '../../../lib/gramjs';
import type { ApiInitialArgs, ApiOnProgress, OnApiUpdate } from '../../types';
import type { Methods, MethodArgs, MethodResponse } from '../methods/types';
import type { WorkerMessageEvent, OriginRequest, ThenArg } from './types';
import type { LocalDb } from '../localDb';
import type { TypedBroadcastChannel } from '../../../util/multitab';

import { IS_MULTITAB_SUPPORTED } from '../../../util/environment';
import { DATA_BROADCAST_CHANNEL_NAME, DEBUG } from '../../../config';
import generateIdFor from '../../../util/generateIdFor';
import { pause } from '../../../util/schedulers';
import { getCurrentTabId, subscribeToMasterChange } from '../../../util/establishMultitabRole';

type RequestStates = {
  messageId: string;
  resolve: Function;
  reject: Function;
  callback?: AnyToVoidFunction;
};

const HEALTH_CHECK_TIMEOUT = 150;
const HEALTH_CHECK_MIN_DELAY = 5 * 1000; // 5 sec

let worker: Worker;
const requestStates = new Map<string, RequestStates>();
const requestStatesByCallback = new Map<AnyToVoidFunction, RequestStates>();
const savedLocalDb: LocalDb = {
  localMessages: {},
  chats: {},
  users: {},
  messages: {},
  documents: {},
  stickerSets: {},
  photos: {},
  webDocuments: {},
};

// TODO Re-use `util/WorkerConnector.ts`

let isMasterTab = true;
subscribeToMasterChange((isMasterTabNew) => {
  isMasterTab = isMasterTabNew;
});

const channel = IS_MULTITAB_SUPPORTED
  ? new BroadcastChannel(DATA_BROADCAST_CHANNEL_NAME) as TypedBroadcastChannel
  : undefined;

export function initApiOnMasterTab(initialArgs: ApiInitialArgs) {
  if (!channel) return;

  channel.postMessage({
    type: 'initApi',
    token: getCurrentTabId(),
    initialArgs,
  });
}

export function initApi(onUpdate: OnApiUpdate, initialArgs: ApiInitialArgs) {
  if (!isMasterTab) {
    initApiOnMasterTab(initialArgs);
    return Promise.resolve();
  }

  if (!worker) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log('>>> START LOAD WORKER');
    }

    worker = new Worker(new URL('./worker.ts', import.meta.url));
    subscribeToWorker(onUpdate);

    if (initialArgs.platform === 'iOS') {
      setupIosHealthCheck();
    }
  }

  return makeRequest({
    type: 'initApi',
    args: [initialArgs, savedLocalDb],
  });
}

export function updateLocalDb(name: keyof LocalDb, prop: string, value: any) {
  savedLocalDb[name][prop] = value;
}

export function updateFullLocalDb(initial: LocalDb) {
  Object.assign(savedLocalDb, initial);
}

export function callApiOnMasterTab(payload: any) {
  if (!channel) return;

  channel.postMessage({
    type: 'callApi',
    token: getCurrentTabId(),
    ...payload,
  });
}

/*
 * Call a worker method on this tab's worker, without transferring to master tab
 * Mostly needed to disconnect worker when re-electing master
 */
export function callApiLocal<T extends keyof Methods>(fnName: T, ...args: MethodArgs<T>) {
  if (!worker) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('API is not initialized');
    }

    return undefined;
  }

  const promise = makeRequest({
    type: 'callMethod',
    name: fnName,
    args,
  });

  // Some TypeScript magic to make sure `VirtualClass` is never returned from any method
  if (DEBUG) {
    (async () => {
      try {
        type ForbiddenTypes =
          Api.VirtualClass<any>
          | (Api.VirtualClass<any> | undefined)[];
        type ForbiddenResponses =
          ForbiddenTypes
          | (AnyLiteral & { [k: string]: ForbiddenTypes });

        // Unwrap all chained promises
        const response = await promise;
        // Make sure responses do not include `VirtualClass` instances
        const allowedResponse: Exclude<typeof response, ForbiddenResponses> = response;
        // Suppress "unused variable" constraint
        void allowedResponse;
      } catch (err) {
        // Do noting
      }
    })();
  }

  return promise as MethodResponse<T>;
}

export function callApi<T extends keyof Methods>(fnName: T, ...args: MethodArgs<T>) {
  if (!worker && isMasterTab) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('API is not initialized');
    }

    return undefined;
  }

  const promise = isMasterTab ? makeRequest({
    type: 'callMethod',
    name: fnName,
    args,
  }) : makeRequestToMaster({
    name: fnName,
    args,
  });

  // Some TypeScript magic to make sure `VirtualClass` is never returned from any method
  if (DEBUG) {
    (async () => {
      try {
        type ForbiddenTypes =
          Api.VirtualClass<any>
          | (Api.VirtualClass<any> | undefined)[];
        type ForbiddenResponses =
          ForbiddenTypes
          | (AnyLiteral & { [k: string]: ForbiddenTypes });

        // Unwrap all chained promises
        const response = await promise;
        // Make sure responses do not include `VirtualClass` instances
        const allowedResponse: Exclude<typeof response, ForbiddenResponses> = response;
        // Suppress "unused variable" constraint
        void allowedResponse;
      } catch (err) {
        // Do noting
      }
    })();
  }

  return promise as MethodResponse<T>;
}

export function cancelApiProgress(progressCallback: ApiOnProgress) {
  progressCallback.isCanceled = true;

  const { messageId } = requestStatesByCallback.get(progressCallback) || {};
  if (!messageId) {
    return;
  }

  if (isMasterTab) {
    cancelApiProgressMaster(messageId);
  } else {
    if (!channel) return;

    channel.postMessage({
      type: 'cancelApiProgress',
      token: getCurrentTabId(),
      messageId,
    });
  }
}

export function cancelApiProgressMaster(messageId: string) {
  worker.postMessage({
    type: 'cancelProgress',
    messageId,
  });
}

function subscribeToWorker(onUpdate: OnApiUpdate) {
  worker.addEventListener('message', ({ data }: WorkerMessageEvent) => {
    if (data.type === 'update') {
      onUpdate(data.update);
    } else if (data.type === 'methodResponse') {
      handleMethodResponse(data);
    } else if (data.type === 'methodCallback') {
      handleMethodCallback(data);
    } else if (data.type === 'unhandledError') {
      throw new Error(data.error?.message);
    }
  });
}

export function handleMethodResponse(data: { messageId: string;
  response?: ThenArg<MethodResponse<keyof Methods>>;
  error?: { message: string };
}) {
  const requestState = requestStates.get(data.messageId);
  if (requestState) {
    if (data.error) {
      requestState.reject(data.error);
    } else {
      requestState.resolve(data.response);
    }
  }
}

export function handleMethodCallback(data: { messageId: string;
  callbackArgs: any[];
}) {
  requestStates.get(data.messageId)?.callback?.(...data.callbackArgs);
}

function makeRequestToMaster(message: {
  messageId?: string;
  name: keyof Methods;
  args: MethodArgs<keyof Methods>;
  withCallback?: boolean;
}) {
  const messageId = generateIdFor(requestStates);
  const payload = {
    messageId,
    ...message,
  };

  const requestState = { messageId } as RequestStates;

  // Re-wrap type because of `postMessage`
  const promise: Promise<MethodResponse<keyof Methods>> = new Promise((resolve, reject) => {
    Object.assign(requestState, { resolve, reject });
  });

  if ('args' in payload && 'name' in payload && typeof payload.args[1] === 'function') {
    payload.withCallback = true;

    const callback = payload.args.pop() as AnyToVoidFunction;
    requestState.callback = callback;
    requestStatesByCallback.set(callback, requestState);
  }

  requestStates.set(messageId, requestState);

  promise
    .catch(() => undefined)
    .finally(() => {
      requestStates.delete(messageId);

      if (requestState.callback) {
        requestStatesByCallback.delete(requestState.callback);
      }
    });

  callApiOnMasterTab(payload);

  return promise;
}

function makeRequest(message: OriginRequest) {
  const messageId = generateIdFor(requestStates);
  const payload: OriginRequest = {
    messageId,
    ...message,
  };

  const requestState = { messageId } as RequestStates;

  // Re-wrap type because of `postMessage`
  const promise: Promise<MethodResponse<keyof Methods>> = new Promise((resolve, reject) => {
    Object.assign(requestState, { resolve, reject });
  });

  if ('args' in payload && 'name' in payload && typeof payload.args[1] === 'function') {
    payload.withCallback = true;

    const callback = payload.args.pop() as AnyToVoidFunction;
    requestState.callback = callback;
    requestStatesByCallback.set(callback, requestState);
  }

  requestStates.set(messageId, requestState);

  promise
    .catch(() => undefined)
    .finally(() => {
      requestStates.delete(messageId);

      if (requestState.callback) {
        requestStatesByCallback.delete(requestState.callback);
      }
    });

  worker.postMessage(payload);

  return promise;
}

const startedAt = Date.now();

// Workaround for iOS sometimes stops interacting with worker
function setupIosHealthCheck() {
  window.addEventListener('focus', () => {
    void ensureWorkerPing();
    // Sometimes a single check is not enough
    setTimeout(() => ensureWorkerPing(), 1000);
  });
}

async function ensureWorkerPing() {
  let isResolved = false;

  try {
    await Promise.race([
      makeRequest({ type: 'ping' }),
      pause(HEALTH_CHECK_TIMEOUT)
        .then(() => (isResolved ? undefined : Promise.reject(new Error('HEALTH_CHECK_TIMEOUT')))),
    ]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);

    if (Date.now() - startedAt >= HEALTH_CHECK_MIN_DELAY) {
      window.location.reload();
    }
  } finally {
    isResolved = true;
  }
}
