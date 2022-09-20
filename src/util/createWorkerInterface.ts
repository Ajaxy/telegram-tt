import type { CancellableCallback, OriginMessageEvent, WorkerMessageData } from './WorkerConnector';
import { DEBUG } from '../config';

declare const self: WorkerGlobalScope;

handleErrors();

const callbackState = new Map<string, CancellableCallback>();

export default function createInterface(api: Record<string, Function>) {
  onmessage = async (message: OriginMessageEvent) => {
    const { data } = message;

    switch (data.type) {
      case 'callMethod': {
        const {
          messageId, name, args, withCallback,
        } = data;
        try {
          if (messageId && withCallback) {
            const callback = (...callbackArgs: any[]) => {
              const lastArg = callbackArgs[callbackArgs.length - 1];

              sendToOrigin({
                type: 'methodCallback',
                messageId,
                callbackArgs,
              }, lastArg instanceof ArrayBuffer ? [lastArg] : undefined);
            };

            callbackState.set(messageId, callback);

            args.push(callback as never);
          }

          const [response, arrayBuffers] = (await api[name](...args)) || [];

          if (messageId) {
            sendToOrigin(
              {
                type: 'methodResponse',
                messageId,
                response,
              },
              arrayBuffers,
            );
          }
        } catch (error: any) {
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
          callback.isCanceled = true;
        }

        break;
      }
    }
  };
}

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

function sendToOrigin(data: WorkerMessageData, arrayBuffers?: ArrayBuffer[]) {
  if (arrayBuffers) {
    postMessage(data, arrayBuffers);
  } else {
    postMessage(data);
  }
}
