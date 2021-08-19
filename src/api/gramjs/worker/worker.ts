import { ApiOnProgress, ApiUpdate } from '../../types';
import { OriginMessageEvent, WorkerMessageData } from './types';

import { DEBUG } from '../../../config';
import { initApi, callApi, cancelApiProgress } from '../provider';

declare const self: WorkerGlobalScope;

handleErrors();

// TODO Re-use `util/createWorkerInterface.ts`

const callbackState = new Map<string, ApiOnProgress>();

if (DEBUG) {
  // eslint-disable-next-line no-console
  console.log('>>> FINISH LOAD WORKER');
}

onmessage = async (message: OriginMessageEvent) => {
  const { data } = message;

  switch (data.type) {
    case 'initApi': {
      await initApi(onUpdate, data.args[0]);
      break;
    }
    case 'callMethod': {
      const { messageId, name, args } = data;
      try {
        if (messageId) {
          const callback = (...callbackArgs: any[]) => {
            const lastArg = callbackArgs[callbackArgs.length - 1];

            sendToOrigin({
              type: 'methodCallback',
              messageId,
              callbackArgs,
            }, lastArg instanceof ArrayBuffer ? lastArg : undefined);
          };

          callbackState.set(messageId, callback);

          args.push(callback as never);
        }

        const response = await callApi(name, ...args);
        const { arrayBuffer } = (typeof response === 'object' && 'arrayBuffer' in response && response) || {};

        if (messageId) {
          sendToOrigin({
            type: 'methodResponse',
            messageId,
            response,
          }, arrayBuffer);
        }
      } catch (error) {
        if (DEBUG) {
          // eslint-disable-next-line no-console
          console.error(error);
        }

        if (messageId) {
          sendToOrigin({
            type: 'methodResponse',
            messageId,
            error: { message: error.message },
          });
        }
      }

      if (messageId) {
        callbackState.delete(messageId);
      }

      break;
    }
    case 'cancelProgress': {
      const callback = callbackState.get(data.messageId);
      if (callback) {
        cancelApiProgress(callback);
      }

      break;
    }
    case 'ping': {
      sendToOrigin({
        type: 'methodResponse',
        messageId: data.messageId!,
      });

      break;
    }
  }
};

function handleErrors() {
  self.onerror = (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    sendToOrigin({ type: 'unhandledError', error: { message: e.error.message || 'Uncaught exception in worker' } });
  };

  self.addEventListener('unhandledrejection', (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    sendToOrigin({ type: 'unhandledError', error: { message: e.reason.message || 'Uncaught rejection in worker' } });
  });
}

function onUpdate(update: ApiUpdate) {
  sendToOrigin({
    type: 'update',
    update,
  });
}

function sendToOrigin(data: WorkerMessageData, arrayBuffer?: ArrayBuffer) {
  if (arrayBuffer) {
    postMessage(data, [arrayBuffer]);
  } else {
    postMessage(data);
  }
}
